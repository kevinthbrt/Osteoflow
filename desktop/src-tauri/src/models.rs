use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProfileSummary {
  pub id: String,
  pub name: String,
  pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Patient {
  pub id: String,
  pub first_name: String,
  pub last_name: String,
  pub birth_date: String,
  pub gender: String,
  pub phone: String,
  pub email: Option<String>,
  pub created_at: String,
  pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PatientInput {
  pub first_name: String,
  pub last_name: String,
  pub birth_date: String,
  pub gender: String,
  pub phone: String,
  pub email: Option<String>,
}
