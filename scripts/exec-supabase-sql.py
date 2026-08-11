import psycopg2
import sys

DB_URL = "postgresql://postgres:ld6LfzAkiY6hvhDU@db.pnsdsqihlwecvxhhddfm.supabase.co:5432/postgres"
SQL_FILE = "/home/z/my-project/download/assethub-supabase-schema.sql"

print("Conectando a Supabase...")
conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

# 1. Limpiar schema existente (por el intento anterior que falló)
print("Limpiando schema public (DROP CASCADE)...")
cur.execute('DROP SCHEMA public CASCADE;')
cur.execute('CREATE SCHEMA public;')
print("Schema recreado.")

# 2. Leer y ejecutar el SQL completo
with open(SQL_FILE, 'r') as f:
    sql = f.read()

print(f"Ejecutando SQL ({len(sql)} chars)...")
try:
    cur.execute(sql)
    print("SQL ejecutado sin errores.")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

# 3. Verificar tablas creadas
cur.execute("""
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
""")
tables = [row[0] for row in cur.fetchall()]
print(f"\nTablas creadas ({len(tables)}):")
for t in tables:
    print(f"  - {t}")

# 4. Verificar triggers
cur.execute("""
    SELECT trigger_name, event_object_table 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    ORDER BY event_object_table
""")
triggers = cur.fetchall()
print(f"\nTriggers creados ({len(triggers)}):")
for name, tbl in triggers:
    print(f"  - {name} ON {tbl}")

cur.close()
conn.close()
print("\nListo. Todo creado correctamente en Supabase.")
