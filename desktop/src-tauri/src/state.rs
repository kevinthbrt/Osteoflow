use std::sync::Mutex;

use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ActiveProfile {
  pub id: String,
  pub db_path: String,
  pub key: Vec<u8>,
}

#[derive(Default)]
pub struct AppState {
  pub active_profile: Mutex<Option<ActiveProfile>>,
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
  #[error("{0}")]
  Validation(String),
  #[error("{0}")]
  Auth(String),
  #[error("{0}")]
  NotFound(String),
  #[error("{0}")]
  Config(String),
  #[error("{0}")]
  Io(String),
  #[error("{0}")]
  Database(String),
}

impl From<AppError> for String {
  fn from(value: AppError) -> Self {
    value.to_string()
  }
}
