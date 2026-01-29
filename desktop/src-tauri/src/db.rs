use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};

use crate::models::{Patient, PatientInput};
use crate::state::AppError;

fn apply_key(conn: &Connection, key: &[u8]) -> Result<(), AppError> {
  let key_hex = hex::encode(key);
  let statement = format!("PRAGMA key = \"x'{}'\";", key_hex);
  conn.execute_batch(&statement)
    .map_err(|err| AppError::Database(err.to_string()))?;
  Ok(())
}

pub fn open_connection(db_path: &str, key: &[u8]) -> Result<Connection, AppError> {
  let conn = Connection::open(db_path)
    .map_err(|err| AppError::Database(err.to_string()))?;
  apply_key(&conn, key)?;
  conn.execute_batch("PRAGMA foreign_keys = ON;")
    .map_err(|err| AppError::Database(err.to_string()))?;
  init_schema(&conn)?;
  Ok(conn)
}

fn init_schema(conn: &Connection) -> Result<(), AppError> {
  conn.execute_batch(
    "CREATE TABLE IF NOT EXISTS patients (
        id TEXT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        birth_date TEXT NOT NULL,
        gender TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );"
  ).map_err(|err| AppError::Database(err.to_string()))?;
  Ok(())
}

pub fn list_patients(conn: &Connection) -> Result<Vec<Patient>, AppError> {
  let mut stmt = conn.prepare(
    "SELECT id, first_name, last_name, birth_date, gender, phone, email, created_at, updated_at
     FROM patients
     ORDER BY created_at DESC"
  ).map_err(|err| AppError::Database(err.to_string()))?;

  let rows = stmt
    .query_map([], |row| {
      Ok(Patient {
        id: row.get(0)?,
        first_name: row.get(1)?,
        last_name: row.get(2)?,
        birth_date: row.get(3)?,
        gender: row.get(4)?,
        phone: row.get(5)?,
        email: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
      })
    })
    .map_err(|err| AppError::Database(err.to_string()))?;

  let mut patients = Vec::new();
  for row in rows {
    patients.push(row.map_err(|err| AppError::Database(err.to_string()))?);
  }

  Ok(patients)
}

pub fn create_patient(conn: &Connection, input: PatientInput) -> Result<Patient, AppError> {
  let id = uuid::Uuid::new_v4().to_string();
  let now = Utc::now().to_rfc3339();

  conn.execute(
    "INSERT INTO patients (id, first_name, last_name, birth_date, gender, phone, email, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    params![
      id,
      input.first_name,
      input.last_name,
      input.birth_date,
      input.gender,
      input.phone,
      input.email,
      now,
      now,
    ],
  ).map_err(|err| AppError::Database(err.to_string()))?;

  let patient = get_patient(conn, &id)?
    .ok_or_else(|| AppError::Database("Impossible de récupérer le patient".into()))?;

  Ok(patient)
}

pub fn delete_patient(conn: &Connection, patient_id: &str) -> Result<(), AppError> {
  conn.execute(
    "DELETE FROM patients WHERE id = ?1",
    params![patient_id],
  ).map_err(|err| AppError::Database(err.to_string()))?;
  Ok(())
}

fn get_patient(conn: &Connection, patient_id: &str) -> Result<Option<Patient>, AppError> {
  conn.query_row(
    "SELECT id, first_name, last_name, birth_date, gender, phone, email, created_at, updated_at
     FROM patients WHERE id = ?1",
    params![patient_id],
    |row| {
      Ok(Patient {
        id: row.get(0)?,
        first_name: row.get(1)?,
        last_name: row.get(2)?,
        birth_date: row.get(3)?,
        gender: row.get(4)?,
        phone: row.get(5)?,
        email: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
      })
    }
  ).optional().map_err(|err| AppError::Database(err.to_string()))
}
