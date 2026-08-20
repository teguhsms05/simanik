"""
VeloceFleet - Sistem Manajemen Inventaris, Pajak, Perawatan & Operasional Kendaraan Real-time
Flask Web Application + SQLite3 Backend
Menjalankan Web Dashboard pada Port 3000
"""

import datetime
import os
import secrets
import sqlite3
import uuid

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_from_directory

load_dotenv()

PORT = int(os.environ.get("APP_PORT", 5010))
HOST = os.environ.get("APP_HOST", "0.0.0.0")
DEBUG = os.environ.get("APP_DEBUG", "False").lower() in ("true", "1", "yes")
DB_FILE = os.environ.get("DB_FILE", "database.db")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)


@app.route("/assets/<path:filename>")
def serve_assets(filename):
    return send_from_directory("assets", filename)


def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.execute('''CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        plate_number TEXT UNIQUE NOT NULL,
        brand TEXT NOT NULL,
        model TEXT NOT NULL,
        year INTEGER NOT NULL,
        category TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        current_odometer REAL NOT NULL,
        last_service_odometer REAL NOT NULL,
        last_service_date TEXT NOT NULL,
        next_service_odometer REAL NOT NULL,
        tax_due_date TEXT NOT NULL,
        stnk_due_date TEXT NOT NULL,
        status TEXT NOT NULL,
        pool_location TEXT NOT NULL,
        annual_tax_cost INTEGER DEFAULT 0,
        image_url TEXT DEFAULT '',
        mechanic_name TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        estimated_service_type TEXT DEFAULT '',
        estimated_service_cost INTEGER DEFAULT 0
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS maintenance_records (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        service_date TEXT NOT NULL,
        odometer REAL NOT NULL,
        workshop_name TEXT NOT NULL,
        mechanic_name TEXT DEFAULT '',
        service_type TEXT NOT NULL,
        description TEXT DEFAULT '',
        cost INTEGER NOT NULL,
        FOREIGN KEY(vehicle_id) REFERENCES vehicles(id)
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS tax_records (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        payment_date TEXT NOT NULL,
        tax_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        new_due_date TEXT NOT NULL,
        receipt_number TEXT NOT NULL,
        notes TEXT DEFAULT ''
    )''')

    c.execute('''CREATE TABLE IF NOT EXISTS trip_logs (
        id TEXT PRIMARY KEY,
        vehicle_id TEXT NOT NULL,
        driver_name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        destination TEXT NOT NULL,
        start_odometer REAL NOT NULL,
        end_odometer REAL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL,
        fuel_cost INTEGER DEFAULT 0,
        fuel_liters REAL DEFAULT 0,
        notes TEXT DEFAULT ''
    )''')

    conn.commit()
    
    try:
        conn.execute("SELECT estimated_service_type FROM vehicles LIMIT 1")
    except sqlite3.OperationalError:
        conn.execute("ALTER TABLE vehicles ADD COLUMN estimated_service_type TEXT DEFAULT ''")
        conn.execute("ALTER TABLE vehicles ADD COLUMN estimated_service_cost INTEGER DEFAULT 0")
        conn.commit()
    
    conn.close()


def seed_data():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM vehicles")
    if c.fetchone()[0] > 0:
        conn.close()
        return

    vehicles = [
        ("veh-1", "B 1492 SSG", "Toyota", "Avanza Veloz 1.5 CVT", 2023, "Mobil MPV/SUV", "Bensin (Pertalite/Pertamax)", 28450, 25000, "2026-06-10", 30000, "2027-02-15", "2028-02-15", "Tersedia", "Pool Utama Jakarta Pusat", 3850000, "/assets/images/avanza_veloz.jpg", "", "Unit operasional harian", "Servis Berkala (Ganti Oli & Filter)", 850000),
        ("veh-2", "B 8820 TQ", "Isuzu", "Giga FVR 240 PS Box Cargo", 2021, "Truk/Bus", "Diesel/Solar", 142100, 135000, "2026-05-18", 145000, "2026-08-25", "2026-08-25", "Tersedia", "Pool Tanjung Priok (Logistik)", 6100000, "/assets/images/isuzu_giga.jpg", "", "Armada logistik utama", "Servis Berat (Ganti Oli & Pengecekan Mesin)", 3500000),
        ("veh-3", "D 1024 YK", "Honda", "Vario 160 CBS", 2022, "Sepeda Motor", "Bensin (Pertalite/Pertamax)", 19800, 15000, "2026-03-20", 20000, "2026-08-05", "2027-05-10", "Tersedia", "Pool Cabang Bandung", 450000, "/assets/images/honda_vario.jpg", "", "Motor operasional kurir", "Servis Berkala (Ganti Oli & Tune Up)", 250000),
        ("veh-4", "L 7731 FA", "Mitsubishi", "L300 Pick Up Euro 4 Diesel", 2022, "Kendaraan Niaga/Pick-up", "Diesel/Solar", 64200, 56000, "2026-04-15", 68000, "2027-01-18", "2027-11-20", "Sedang Digunakan", "Pool Cabang Surabaya", 2400000, "/assets/images/mitsubishi_l300.jpg", "", "Pick up niaga operasional", "Servis Berkala (Ganti Oli & Filter Solar)", 1200000),
        ("veh-5", "B 2049 RIZ", "Toyota", "Kijang Innova Zenix 2.0 V Hybrid", 2024, "Mobil MPV/SUV", "Hibrida (Hybrid)", 14500, 14500, "2026-08-10", 24500, "2027-01-10", "2029-01-10", "Dalam Perawatan", "Pool Utama Jakarta Pusat", 4200000, "/assets/images/kijang_innova.jpg", "", "Unit dinas direksi", "Perbaikan Sistem Hybrid & Servis Besar", 2800000),
        ("veh-6", "B 9012 EVC", "Hyundai", "Ioniq 5 Signature Long Range EV", 2023, "Sedan/Hatchback", "Listrik (EV)", 21300, 15000, "2026-05-05", 30000, "2026-09-20", "2028-09-20", "Tersedia", "Pool Utama Jakarta Pusat", 3200000, "/assets/images/hyundai_ioniq.jpg", "", "Kendaraan listrik premium", "Pengecekan Baterai & Servis Berkala EV", 1500000)
    ]
    c.executemany("INSERT INTO vehicles VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", vehicles)

    maint = [
        ("srv-1", "veh-5", "2026-08-10", 14500, "Auto2000 Cempaka Putih", "Bambang Supriadi", "Servis Berkala", "Ganti oli mesin sintetis 0W-20, filter oli, balancing ban, pembersihan throttle body", 1450000),
        ("srv-2", "veh-1", "2026-06-10", 25000, "Nasmoco Jakarta", "Rian Saputra", "Ganti Oli", "Ganti oli mesin TMO 5W-30 & filter udara.", 780000),
        ("srv-3", "veh-2", "2026-05-18", 135000, "Bengkel Resmi Isuzu Astra Tanjung Priok", "Eko Prasetyo", "Perbaikan Rem", "Pengantian kampas rem depan belakang dan pengecekan sistem hidrolik rem.", 3200000)
    ]
    c.executemany("INSERT INTO maintenance_records VALUES (?,?,?,?,?,?,?,?,?)", maint)

    tax = [
        ("tax-1", "veh-1", "2026-02-10", "Pajak Tahunan", 3850000, "2027-02-15", "SKUM-2026-029104", ""),
        ("tax-2", "veh-4", "2026-01-12", "Pajak Tahunan", 2400000, "2027-01-18", "SKUM-2026-011822", "")
    ]
    c.executemany("INSERT INTO tax_records VALUES (?,?,?,?,?,?,?,?)", tax)

    trips = [
        ("trip-1", "veh-4", "Sutrisno (Driver Logistik)", "Pengiriman Suku Cadang Mesin Industri", "Kawasan Industri Rungkut - Sidoarjo", 64120, None, "2026-08-11 14:30:00", None, "Berjalan", 0, 0, ""),
        ("trip-2", "veh-1", "Ahmad Yani", "Dinas Lapangan Direksi Keuangan", "Kementerian Keuangan RI - Jakarta Pusat", 28380, 28450, "2026-08-10 08:00:00", "2026-08-10 17:00:00", "Selesai", 150000, 12.5, ""),
        ("trip-3", "veh-2", "Hendra Gunawan", "Pengangkutan Konfeksi & Bahan Baku", "Gudang Garam - Karawang", 141750, 142100, "2026-08-08 06:00:00", "2026-08-08 18:00:00", "Selesai", 850000, 65.0, "")
    ]
    c.executemany("INSERT INTO trip_logs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", trips)

    conn.commit()
    conn.close()


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/vehicles", methods=["GET"])
def api_vehicles():
    conn = get_db()
    rows = conn.execute("SELECT * FROM vehicles ORDER BY plate_number").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/vehicles", methods=["POST"])
def api_vehicles_create():
    data = request.get_json() or {}
    conn = get_db()
    vid = f"veh-{uuid.uuid4().hex[:8]}"
    odo = data.get("current_odometer", 0)
    conn.execute("""INSERT INTO vehicles (id, plate_number, brand, model, year, category, fuel_type,
        current_odometer, last_service_odometer, last_service_date, next_service_odometer,
        tax_due_date, stnk_due_date, status, pool_location, annual_tax_cost, image_url, notes,
        estimated_service_type, estimated_service_cost)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (vid, data.get("plate_number", "").upper(), data.get("brand", ""), data.get("model", ""),
         data.get("year", 2024), data.get("category", "Mobil MPV/SUV"), data.get("fuel_type", "Bensin (Pertalite/Pertamax)"),
         odo, odo, datetime.date.today().isoformat(), odo + 10000,
         data.get("tax_due_date", datetime.date.today().isoformat()),
         data.get("stnk_due_date", datetime.date.today().isoformat()),
         "Tersedia", data.get("pool_location", "Pool Utama"), 0,
         data.get("image_url", ""), "",
         data.get("estimated_service_type", ""), data.get("estimated_service_cost", 0)))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "id": vid}), 201


@app.route("/api/vehicles/<vehicle_id>", methods=["PUT"])
def api_vehicles_update(vehicle_id):
    data = request.get_json() or {}
    conn = get_db()
    conn.execute("""UPDATE vehicles SET
        plate_number = ?, brand = ?, model = ?, year = ?, category = ?, fuel_type = ?,
        current_odometer = ?, tax_due_date = ?, stnk_due_date = ?, status = ?,
        pool_location = ?, annual_tax_cost = ?, image_url = ?, notes = ?,
        estimated_service_type = ?, estimated_service_cost = ?
        WHERE id = ?""",
        (data.get("plate_number", "").upper(), data.get("brand", ""), data.get("model", ""),
         data.get("year", 2024), data.get("category", "Mobil MPV/SUV"),
         data.get("fuel_type", "Bensin (Pertalite/Pertamax)"),
         data.get("current_odometer", 0),
         data.get("tax_due_date", ""), data.get("stnk_due_date", ""),
         data.get("status", "Tersedia"), data.get("pool_location", ""),
         data.get("annual_tax_cost", 0), data.get("image_url", ""),
         data.get("notes", ""),
         data.get("estimated_service_type", ""), data.get("estimated_service_cost", 0),
         vehicle_id))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "id": vehicle_id})


@app.route("/api/maintenance", methods=["GET"])
def api_maintenance():
    conn = get_db()
    rows = conn.execute("SELECT * FROM maintenance_records ORDER BY service_date DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/maintenance", methods=["POST"])
def api_maintenance_create():
    data = request.get_json() or {}
    conn = get_db()
    sid = f"srv-{uuid.uuid4().hex[:8]}"
    vid = data.get("vehicle_id")
    odo = data.get("odometer", 0)
    service_date = data.get("service_date", datetime.date.today().isoformat())
    conn.execute("""INSERT INTO maintenance_records (id, vehicle_id, service_date, odometer, workshop_name, mechanic_name, service_type, description, cost)
        VALUES (?,?,?,?,?,?,?,?,?)""",
        (sid, vid, service_date, odo, data.get("workshop_name", ""), data.get("mechanic_name", ""),
         data.get("service_type", ""), data.get("description", ""), data.get("cost", 0)))
    conn.execute("""UPDATE vehicles SET current_odometer = MAX(current_odometer, ?),
        last_service_odometer = ?, last_service_date = ?, next_service_odometer = ? + 10000
        WHERE id = ?""", (odo, odo, service_date, odo, vid))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "id": sid}), 201


@app.route("/api/tax-records", methods=["GET"])
def api_tax_records():
    conn = get_db()
    rows = conn.execute("SELECT * FROM tax_records ORDER BY payment_date DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/tax-records", methods=["POST"])
def api_tax_records_create():
    data = request.get_json() or {}
    conn = get_db()
    tid = f"tax-{uuid.uuid4().hex[:8]}"
    vid = data.get("vehicle_id")
    tax_type = data.get("tax_type", "Pajak Tahunan")
    new_due = data.get("new_due_date", "")
    conn.execute("""INSERT INTO tax_records (id, vehicle_id, payment_date, tax_type, amount, new_due_date, receipt_number, notes)
        VALUES (?,?,?,?,?,?,?,?)""",
        (tid, vid, data.get("payment_date", datetime.date.today().isoformat()),
         tax_type, data.get("amount", 0), new_due, data.get("receipt_number", ""), ""))
    if "Tahunan" in tax_type:
        conn.execute("UPDATE vehicles SET tax_due_date = ? WHERE id = ?", (new_due, vid))
    else:
        conn.execute("UPDATE vehicles SET stnk_due_date = ? WHERE id = ?", (new_due, vid))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "id": tid}), 201


@app.route("/api/tax-records/<tax_id>", methods=["PUT"])
def api_tax_records_update(tax_id):
    data = request.get_json() or {}
    conn = get_db()
    old = conn.execute("SELECT * FROM tax_records WHERE id = ?", (tax_id,)).fetchone()
    if not old:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    vid = data.get("vehicle_id", old["vehicle_id"])
    tax_type = data.get("tax_type", old["tax_type"])
    new_due = data.get("new_due_date", old["new_due_date"])
    conn.execute("""UPDATE tax_records SET vehicle_id=?, payment_date=?, tax_type=?, amount=?,
        new_due_date=?, receipt_number=?, notes=? WHERE id=?""",
        (vid, data.get("payment_date", old["payment_date"]), tax_type,
         data.get("amount", old["amount"]), new_due,
         data.get("receipt_number", old["receipt_number"]),
         data.get("notes", old["notes"]), tax_id))
    if "Tahunan" in tax_type:
        conn.execute("UPDATE vehicles SET tax_due_date = ? WHERE id = ?", (new_due, vid))
    else:
        conn.execute("UPDATE vehicles SET stnk_due_date = ? WHERE id = ?", (new_due, vid))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


@app.route("/api/tax-records/<tax_id>", methods=["DELETE"])
def api_tax_records_delete(tax_id):
    conn = get_db()
    conn.execute("DELETE FROM tax_records WHERE id = ?", (tax_id,))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok"})


@app.route("/api/trips", methods=["GET"])
def api_trips():
    conn = get_db()
    rows = conn.execute("SELECT * FROM trip_logs ORDER BY start_time DESC").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@app.route("/api/trips", methods=["POST"])
def api_trips_create():
    data = request.get_json() or {}
    conn = get_db()
    trip_id = f"trip-{uuid.uuid4().hex[:8]}"
    vid = data.get("vehicle_id")
    conn.execute("""INSERT INTO trip_logs (id, vehicle_id, driver_name, purpose, destination, start_odometer, start_time, status)
        VALUES (?,?,?,?,?,?,?,?)""",
        (trip_id, vid, data.get("driver_name", ""), data.get("purpose", ""),
         data.get("destination", ""), data.get("start_odometer", 0),
         datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "Berjalan"))
    conn.execute("UPDATE vehicles SET status = 'Sedang Digunakan' WHERE id = ?", (vid,))
    conn.commit()
    conn.close()
    return jsonify({"status": "ok", "id": trip_id}), 201


@app.route("/api/trips/<trip_id>/complete", methods=["PUT"])
def api_trips_complete(trip_id):
    data = request.get_json() or {}
    conn = get_db()
    end_odo = data.get("end_odometer", 0)
    vid = data.get("vehicle_id")
    conn.execute("""UPDATE trip_logs SET end_odometer = ?, end_time = ?, status = 'Selesai',
        fuel_cost = ? WHERE id = ?""",
        (end_odo, datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
         data.get("fuel_cost", 0), trip_id))
    conn.execute("UPDATE vehicles SET current_odometer = MAX(current_odometer, ?), status = 'Tersedia' WHERE id = ?",
        (end_odo, vid))
    conn.commit()
    conn.close()
    return jsonify({"status": "completed"})


@app.route("/api/reset-demo", methods=["POST"])
def api_reset_demo():
    conn = get_db()
    conn.execute("DELETE FROM vehicles")
    conn.execute("DELETE FROM maintenance_records")
    conn.execute("DELETE FROM tax_records")
    conn.execute("DELETE FROM trip_logs")
    conn.commit()
    conn.close()
    seed_data()
    return jsonify({"status": "reset"})


init_db()
seed_data()

if __name__ == "__main__":
    app.run(host=HOST, port=PORT, debug=DEBUG)
