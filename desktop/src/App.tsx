import { useEffect, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'

interface ProfileSummary {
  id: string
  name: string
  created_at: string
}

interface Patient {
  id: string
  first_name: string
  last_name: string
  birth_date: string
  gender: 'M' | 'F'
  phone: string
  email?: string | null
}

type StatusMessage = { type: 'success' | 'error'; message: string } | null

const emptyPatient: Patient = {
  id: '',
  first_name: '',
  last_name: '',
  birth_date: '',
  gender: 'F',
  phone: '',
  email: '',
}

export default function App() {
  const [profiles, setProfiles] = useState<ProfileSummary[]>([])
  const [activeProfile, setActiveProfile] = useState<ProfileSummary | null>(null)
  const [status, setStatus] = useState<StatusMessage>(null)

  const [profileName, setProfileName] = useState('')
  const [profilePassword, setProfilePassword] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [selectedProfileId, setSelectedProfileId] = useState<string>('')

  const [patients, setPatients] = useState<Patient[]>([])
  const [patientForm, setPatientForm] = useState<Patient>(emptyPatient)
  const [isLoadingPatients, setIsLoadingPatients] = useState(false)

  const activeProfileLabel = useMemo(() => {
    if (!activeProfile) return 'Aucun profil ouvert'
    return `${activeProfile.name} • ${new Date(activeProfile.created_at).toLocaleDateString('fr-FR')}`
  }, [activeProfile])

  const loadProfiles = async () => {
    try {
      const list = await invoke<ProfileSummary[]>('list_profiles')
      setProfiles(list)
      if (!selectedProfileId && list.length > 0) {
        setSelectedProfileId(list[0].id)
      }
    } catch (error) {
      setStatus({ type: 'error', message: `Impossible de charger les profils: ${String(error)}` })
    }
  }

  const loadPatients = async () => {
    setIsLoadingPatients(true)
    try {
      const list = await invoke<Patient[]>('list_patients')
      setPatients(list)
    } catch (error) {
      setStatus({ type: 'error', message: `Impossible de charger les patients: ${String(error)}` })
    } finally {
      setIsLoadingPatients(false)
    }
  }

  useEffect(() => {
    loadProfiles()
  }, [])

  useEffect(() => {
    if (activeProfile) {
      loadPatients()
    }
  }, [activeProfile])

  const handleCreateProfile = async () => {
    if (!profileName || !profilePassword) {
      setStatus({ type: 'error', message: 'Nom et mot de passe requis.' })
      return
    }

    try {
      const created = await invoke<ProfileSummary>('create_profile', {
        name: profileName,
        password: profilePassword,
      })
      setProfiles((prev) => [...prev, created])
      setProfileName('')
      setProfilePassword('')
      setStatus({ type: 'success', message: 'Profil créé avec succès.' })
    } catch (error) {
      setStatus({ type: 'error', message: `Création impossible: ${String(error)}` })
    }
  }

  const handleOpenProfile = async () => {
    if (!selectedProfileId || !loginPassword) {
      setStatus({ type: 'error', message: 'Sélectionne un profil et un mot de passe.' })
      return
    }

    try {
      const opened = await invoke<ProfileSummary>('open_profile', {
        profileId: selectedProfileId,
        password: loginPassword,
      })
      setActiveProfile(opened)
      setLoginPassword('')
      setStatus({ type: 'success', message: `Profil ${opened.name} ouvert.` })
    } catch (error) {
      setStatus({ type: 'error', message: `Connexion impossible: ${String(error)}` })
    }
  }

  const handlePatientSubmit = async () => {
    if (!patientForm.first_name || !patientForm.last_name || !patientForm.birth_date || !patientForm.phone) {
      setStatus({ type: 'error', message: 'Merci de remplir les champs obligatoires.' })
      return
    }

    try {
      const created = await invoke<Patient>('create_patient', {
        patient: {
          ...patientForm,
          email: patientForm.email || null,
        },
      })
      setPatients((prev) => [created, ...prev])
      setPatientForm(emptyPatient)
      setStatus({ type: 'success', message: 'Patient ajouté.' })
    } catch (error) {
      setStatus({ type: 'error', message: `Impossible de créer le patient: ${String(error)}` })
    }
  }

  const handlePatientDelete = async (id: string) => {
    try {
      await invoke('delete_patient', { patientId: id })
      setPatients((prev) => prev.filter((p) => p.id !== id))
      setStatus({ type: 'success', message: 'Patient supprimé.' })
    } catch (error) {
      setStatus({ type: 'error', message: `Suppression impossible: ${String(error)}` })
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="title">Osteoflow Desktop — POC</div>
          <div className="subtitle">Profils locaux + SQLite (SQLCipher)</div>
        </div>
        <span className="badge">{activeProfileLabel}</span>
      </div>

      {status && (
        <div className="alert" role="alert">
          {status.message}
        </div>
      )}

      {!activeProfile ? (
        <div className="stack">
          <div className="card">
            <div className="title">Choisir un profil</div>
            <p className="helper">Sélectionne un profil existant puis saisis le mot de passe.</p>
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="stack">
                <label>Profil</label>
                <select
                  value={selectedProfileId}
                  onChange={(event) => setSelectedProfileId(event.target.value)}
                >
                  {profiles.length === 0 && <option value="">Aucun profil</option>}
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stack">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="primary" onClick={handleOpenProfile}>
                Ouvrir le profil
              </button>
              <button className="secondary" onClick={loadProfiles}>
                Rafraîchir
              </button>
            </div>
          </div>

          <div className="card">
            <div className="title">Créer un profil</div>
            <p className="helper">Un profil = une base locale chiffrée.</p>
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="stack">
                <label>Nom du profil</label>
                <input
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  placeholder="Cabinet Dupont"
                />
              </div>
              <div className="stack">
                <label>Mot de passe</label>
                <input
                  type="password"
                  value={profilePassword}
                  onChange={(event) => setProfilePassword(event.target.value)}
                />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="primary" onClick={handleCreateProfile}>
                Créer le profil
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="card">
            <div className="title">Ajouter un patient</div>
            <div className="grid-2" style={{ marginTop: 16 }}>
              <div className="stack">
                <label>Prénom *</label>
                <input
                  value={patientForm.first_name}
                  onChange={(event) => setPatientForm({ ...patientForm, first_name: event.target.value })}
                />
              </div>
              <div className="stack">
                <label>Nom *</label>
                <input
                  value={patientForm.last_name}
                  onChange={(event) => setPatientForm({ ...patientForm, last_name: event.target.value })}
                />
              </div>
              <div className="stack">
                <label>Date de naissance *</label>
                <input
                  type="date"
                  value={patientForm.birth_date}
                  onChange={(event) => setPatientForm({ ...patientForm, birth_date: event.target.value })}
                />
              </div>
              <div className="stack">
                <label>Genre *</label>
                <select
                  value={patientForm.gender}
                  onChange={(event) => setPatientForm({ ...patientForm, gender: event.target.value as Patient['gender'] })}
                >
                  <option value="F">F</option>
                  <option value="M">M</option>
                </select>
              </div>
              <div className="stack">
                <label>Téléphone *</label>
                <input
                  value={patientForm.phone}
                  onChange={(event) => setPatientForm({ ...patientForm, phone: event.target.value })}
                />
              </div>
              <div className="stack">
                <label>Email</label>
                <input
                  value={patientForm.email ?? ''}
                  onChange={(event) => setPatientForm({ ...patientForm, email: event.target.value })}
                />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="primary" onClick={handlePatientSubmit}>
                Enregistrer le patient
              </button>
            </div>
          </div>

          <div className="card">
            <div className="title">Patients ({patients.length})</div>
            {isLoadingPatients ? (
              <p className="helper">Chargement...</p>
            ) : (
              <table className="table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>Nom</th>
                    <th>Date de naissance</th>
                    <th>Téléphone</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((patient) => (
                    <tr key={patient.id}>
                      <td>{patient.first_name} {patient.last_name}</td>
                      <td>{patient.birth_date}</td>
                      <td>{patient.phone}</td>
                      <td>{patient.email || '-'}</td>
                      <td>
                        <button className="danger" onClick={() => handlePatientDelete(patient.id)}>
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  ))}
                  {patients.length === 0 && (
                    <tr>
                      <td colSpan={5} className="helper">Aucun patient pour ce profil.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
