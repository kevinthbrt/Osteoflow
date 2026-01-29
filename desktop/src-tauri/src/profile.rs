use std::fs;
use std::path::{Path, PathBuf};

use argon2::{Algorithm, Argon2, Params, Version};
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use rand::rngs::OsRng;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::models::ProfileSummary;
use crate::state::AppError;

const PROFILE_FILE: &str = "profiles.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Argon2ParamsConfig {
  pub m_cost: u32,
  pub t_cost: u32,
  pub p_cost: u32,
  pub output_len: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StoredProfile {
  pub id: String,
  pub name: String,
  pub created_at: String,
  pub db_path: String,
  pub password_hash: String,
  pub key_salt_b64: String,
  pub argon2_params: Argon2ParamsConfig,
}

impl StoredProfile {
  pub fn summary(&self) -> ProfileSummary {
    ProfileSummary {
      id: self.id.clone(),
      name: self.name.clone(),
      created_at: self.created_at.clone(),
    }
  }
}

pub fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
  tauri::api::path::app_data_dir(&app.config())
    .ok_or_else(|| AppError::Config("Impossible de résoudre le dossier app data".into()))
}

fn profiles_file_path(app: &AppHandle) -> Result<PathBuf, AppError> {
  let dir = app_data_dir(app)?;
  Ok(dir.join(PROFILE_FILE))
}

fn ensure_parent(path: &Path) -> Result<(), AppError> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent).map_err(|err| AppError::Io(err.to_string()))?;
  }
  Ok(())
}

pub fn load_profiles(app: &AppHandle) -> Result<Vec<StoredProfile>, AppError> {
  let path = profiles_file_path(app)?;
  if !path.exists() {
    return Ok(Vec::new());
  }
  let content = fs::read_to_string(&path).map_err(|err| AppError::Io(err.to_string()))?;
  let profiles = serde_json::from_str::<Vec<StoredProfile>>(&content)
    .map_err(|err| AppError::Io(err.to_string()))?;
  Ok(profiles)
}

pub fn save_profiles(app: &AppHandle, profiles: &[StoredProfile]) -> Result<(), AppError> {
  let path = profiles_file_path(app)?;
  ensure_parent(&path)?;
  let data = serde_json::to_string_pretty(profiles).map_err(|err| AppError::Io(err.to_string()))?;
  fs::write(&path, data).map_err(|err| AppError::Io(err.to_string()))?;
  Ok(())
}

pub fn create_profile(app: &AppHandle, name: &str, password: &str) -> Result<StoredProfile, AppError> {
  if name.trim().is_empty() {
    return Err(AppError::Validation("Le nom du profil est requis".into()));
  }
  if password.trim().is_empty() {
    return Err(AppError::Validation("Le mot de passe est requis".into()));
  }

  let mut profiles = load_profiles(app)?;

  let id = uuid::Uuid::new_v4().to_string();
  let created_at = Utc::now().to_rfc3339();

  let mut salt_bytes = [0u8; 16];
  OsRng.fill_bytes(&mut salt_bytes);
  let key_salt_b64 = general_purpose::STANDARD.encode(salt_bytes);

  let params = Argon2ParamsConfig {
    m_cost: 19456,
    t_cost: 2,
    p_cost: 1,
    output_len: 32,
  };

  let argon2_params = Params::new(params.m_cost, params.t_cost, params.p_cost, Some(params.output_len as usize))
    .map_err(|err| AppError::Config(err.to_string()))?;

  let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, argon2_params);

  let salt = SaltString::generate(&mut OsRng);
  let password_hash = argon2
    .hash_password(password.as_bytes(), &salt)
    .map_err(|err| AppError::Config(err.to_string()))?
    .to_string();

  let profile_dir = app_data_dir(app)?.join("profiles").join(&id);
  fs::create_dir_all(&profile_dir).map_err(|err| AppError::Io(err.to_string()))?;
  let db_path = profile_dir.join("profile.db");

  let stored = StoredProfile {
    id: id.clone(),
    name: name.trim().to_string(),
    created_at,
    db_path: db_path.to_string_lossy().to_string(),
    password_hash,
    key_salt_b64,
    argon2_params: params,
  };

  profiles.push(stored.clone());
  save_profiles(app, &profiles)?;

  Ok(stored)
}

pub fn verify_password(profile: &StoredProfile, password: &str) -> Result<(), AppError> {
  let parsed_hash = PasswordHash::new(&profile.password_hash)
    .map_err(|err| AppError::Config(err.to_string()))?;

  let params = Params::new(
    profile.argon2_params.m_cost,
    profile.argon2_params.t_cost,
    profile.argon2_params.p_cost,
    Some(profile.argon2_params.output_len as usize),
  ).map_err(|err| AppError::Config(err.to_string()))?;

  let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
  argon2
    .verify_password(password.as_bytes(), &parsed_hash)
    .map_err(|_| AppError::Auth("Mot de passe incorrect".into()))
}

pub fn derive_key(profile: &StoredProfile, password: &str) -> Result<Vec<u8>, AppError> {
  let salt_bytes = general_purpose::STANDARD
    .decode(&profile.key_salt_b64)
    .map_err(|err| AppError::Config(err.to_string()))?;

  let params = Params::new(
    profile.argon2_params.m_cost,
    profile.argon2_params.t_cost,
    profile.argon2_params.p_cost,
    Some(profile.argon2_params.output_len as usize),
  ).map_err(|err| AppError::Config(err.to_string()))?;

  let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
  let mut key = vec![0u8; profile.argon2_params.output_len as usize];

  argon2
    .hash_password_into(password.as_bytes(), &salt_bytes, &mut key)
    .map_err(|err| AppError::Config(err.to_string()))?;

  Ok(key)
}
