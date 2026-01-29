mod db;
mod models;
mod profile;
mod state;

use tauri::State;

use crate::models::{Patient, PatientInput, ProfileSummary};
use crate::profile::{create_profile as create_profile_record, derive_key, load_profiles, verify_password};
use crate::state::{ActiveProfile, AppError, AppState};

fn get_active_profile(state: &State<AppState>) -> Result<ActiveProfile, AppError> {
  let guard = state.active_profile.lock().map_err(|_| AppError::Config("Verrouillage impossible".into()))?;
  guard.clone().ok_or_else(|| AppError::Auth("Aucun profil ouvert".into()))
}

#[tauri::command]
fn list_profiles(app: tauri::AppHandle) -> Result<Vec<ProfileSummary>, String> {
  load_profiles(&app)
    .map(|profiles| profiles.into_iter().map(|profile| profile.summary()).collect())
    .map_err(String::from)
}

#[tauri::command]
fn create_profile(
  app: tauri::AppHandle,
  name: String,
  password: String,
) -> Result<ProfileSummary, String> {
  create_profile_record(&app, &name, &password)
    .map(|profile| profile.summary())
    .map_err(String::from)
}

#[tauri::command]
fn open_profile(
  app: tauri::AppHandle,
  state: State<AppState>,
  profile_id: String,
  password: String,
) -> Result<ProfileSummary, String> {
  let profiles = load_profiles(&app).map_err(String::from)?;
  let profile = profiles
    .into_iter()
    .find(|p| p.id == profile_id)
    .ok_or_else(|| String::from(AppError::NotFound("Profil introuvable".into())))?;

  verify_password(&profile, &password).map_err(String::from)?;
  let key = derive_key(&profile, &password).map_err(String::from)?;

  let conn = db::open_connection(&profile.db_path, &key).map_err(String::from)?;
  drop(conn);

  let mut guard = state.active_profile.lock().map_err(|_| AppError::Config("Verrouillage impossible".into()))?;
  *guard = Some(ActiveProfile {
    id: profile.id.clone(),
    db_path: profile.db_path.clone(),
    key,
  });

  Ok(profile.summary())
}

#[tauri::command]
fn list_patients(state: State<AppState>) -> Result<Vec<Patient>, String> {
  let active = get_active_profile(&state).map_err(String::from)?;
  let conn = db::open_connection(&active.db_path, &active.key).map_err(String::from)?;
  db::list_patients(&conn).map_err(String::from)
}

#[tauri::command]
fn create_patient(state: State<AppState>, patient: PatientInput) -> Result<Patient, String> {
  let active = get_active_profile(&state).map_err(String::from)?;
  let conn = db::open_connection(&active.db_path, &active.key).map_err(String::from)?;
  db::create_patient(&conn, patient).map_err(String::from)
}

#[tauri::command]
fn delete_patient(state: State<AppState>, patient_id: String) -> Result<(), String> {
  let active = get_active_profile(&state).map_err(String::from)?;
  let conn = db::open_connection(&active.db_path, &active.key).map_err(String::from)?;
  db::delete_patient(&conn, &patient_id).map_err(String::from)
}

fn main() {
  tauri::Builder::default()
    .manage(AppState::default())
    .invoke_handler(tauri::generate_handler![
      list_profiles,
      create_profile,
      open_profile,
      list_patients,
      create_patient,
      delete_patient,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
