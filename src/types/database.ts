export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Gender = 'M' | 'F'
export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled'
export type PaymentMethod = 'card' | 'cash' | 'check' | 'transfer' | 'other'
export type EmailTemplateType = 'invoice' | 'follow_up_7d'
export type TaskStatus = 'pending' | 'completed' | 'failed' | 'cancelled'
export type TaskType = 'follow_up_email'
export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'
export type MedicalHistoryType = 'traumatic' | 'medical' | 'surgical' | 'family'
export type OnsetDurationUnit = 'days' | 'weeks' | 'months' | 'years'

export interface Database {
  public: {
    Tables: {
      practitioners: {
        Row: {
          id: string
          user_id: string
          first_name: string
          last_name: string
          email: string
          phone: string | null
          practice_name: string | null
          address: string | null
          city: string | null
          postal_code: string | null
          siret: string | null
          rpps: string | null
          specialty: string | null
          default_rate: number
          invoice_prefix: string
          invoice_next_number: number
          logo_url: string | null
          stamp_url: string | null
          accountant_email: string | null
          primary_color: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          first_name: string
          last_name: string
          email: string
          phone?: string | null
          practice_name?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          siret?: string | null
          rpps?: string | null
          specialty?: string | null
          default_rate?: number
          invoice_prefix?: string
          invoice_next_number?: number
          logo_url?: string | null
          stamp_url?: string | null
          accountant_email?: string | null
          primary_color?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          practice_name?: string | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
          siret?: string | null
          rpps?: string | null
          specialty?: string | null
          default_rate?: number
          invoice_prefix?: string
          invoice_next_number?: number
          logo_url?: string | null
          stamp_url?: string | null
          accountant_email?: string | null
          primary_color?: string
          created_at?: string
          updated_at?: string
        }
      }
      patients: {
        Row: {
          id: string
          practitioner_id: string
          gender: Gender
          first_name: string
          last_name: string
          birth_date: string
          phone: string
          email: string | null
          profession: string | null
          trauma_history: string | null
          medical_history: string | null
          surgical_history: string | null
          family_history: string | null
          notes: string | null
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          practitioner_id: string
          gender: Gender
          first_name: string
          last_name: string
          birth_date: string
          phone: string
          email?: string | null
          profession?: string | null
          trauma_history?: string | null
          medical_history?: string | null
          surgical_history?: string | null
          family_history?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          practitioner_id?: string
          gender?: Gender
          first_name?: string
          last_name?: string
          birth_date?: string
          phone?: string
          email?: string | null
          profession?: string | null
          trauma_history?: string | null
          medical_history?: string | null
          surgical_history?: string | null
          family_history?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
      }
      consultations: {
        Row: {
          id: string
          patient_id: string
          date_time: string
          reason: string
          anamnesis: string | null
          examination: string | null
          advice: string | null
          follow_up_7d: boolean
          follow_up_sent_at: string | null
          created_at: string
          updated_at: string
          archived_at: string | null
        }
        Insert: {
          id?: string
          patient_id: string
          date_time?: string
          reason: string
          anamnesis?: string | null
          examination?: string | null
          advice?: string | null
          follow_up_7d?: boolean
          follow_up_sent_at?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
        Update: {
          id?: string
          patient_id?: string
          date_time?: string
          reason?: string
          anamnesis?: string | null
          examination?: string | null
          advice?: string | null
          follow_up_7d?: boolean
          follow_up_sent_at?: string | null
          created_at?: string
          updated_at?: string
          archived_at?: string | null
        }
      }
      invoices: {
        Row: {
          id: string
          consultation_id: string
          invoice_number: string
          amount: number
          status: InvoiceStatus
          issued_at: string | null
          paid_at: string | null
          pdf_url: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          consultation_id: string
          invoice_number: string
          amount: number
          status?: InvoiceStatus
          issued_at?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          consultation_id?: string
          invoice_number?: string
          amount?: number
          status?: InvoiceStatus
          issued_at?: string | null
          paid_at?: string | null
          pdf_url?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      payments: {
        Row: {
          id: string
          invoice_id: string
          amount: number
          method: PaymentMethod
          payment_date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          amount: number
          method: PaymentMethod
          payment_date?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          amount?: number
          method?: PaymentMethod
          payment_date?: string
          notes?: string | null
          created_at?: string
        }
      }
      email_templates: {
        Row: {
          id: string
          practitioner_id: string
          type: EmailTemplateType
          subject: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          practitioner_id: string
          type: EmailTemplateType
          subject: string
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          practitioner_id?: string
          type?: EmailTemplateType
          subject?: string
          body?: string
          created_at?: string
          updated_at?: string
        }
      }
      scheduled_tasks: {
        Row: {
          id: string
          practitioner_id: string
          type: TaskType
          consultation_id: string | null
          scheduled_for: string
          executed_at: string | null
          status: TaskStatus
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          practitioner_id: string
          type: TaskType
          consultation_id?: string | null
          scheduled_for: string
          executed_at?: string | null
          status?: TaskStatus
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          practitioner_id?: string
          type?: TaskType
          consultation_id?: string | null
          scheduled_for?: string
          executed_at?: string | null
          status?: TaskStatus
          error_message?: string | null
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          practitioner_id: string | null
          table_name: string
          record_id: string
          action: AuditAction
          old_data: Json | null
          new_data: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          practitioner_id?: string | null
          table_name: string
          record_id: string
          action: AuditAction
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          practitioner_id?: string | null
          table_name?: string
          record_id?: string
          action?: AuditAction
          old_data?: Json | null
          new_data?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      saved_reports: {
        Row: {
          id: string
          practitioner_id: string
          name: string
          filters: Json
          created_at: string
        }
        Insert: {
          id?: string
          practitioner_id: string
          name: string
          filters?: Json
          created_at?: string
        }
        Update: {
          id?: string
          practitioner_id?: string
          name?: string
          filters?: Json
          created_at?: string
        }
      }
      medical_history_entries: {
        Row: {
          id: string
          patient_id: string
          history_type: MedicalHistoryType
          description: string
          onset_date: string | null
          onset_age: number | null
          onset_duration_value: number | null
          onset_duration_unit: OnsetDurationUnit | null
          is_vigilance: boolean
          note: string | null
          display_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          patient_id: string
          history_type: MedicalHistoryType
          description: string
          onset_date?: string | null
          onset_age?: number | null
          onset_duration_value?: number | null
          onset_duration_unit?: OnsetDurationUnit | null
          is_vigilance?: boolean
          note?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          patient_id?: string
          history_type?: MedicalHistoryType
          description?: string
          onset_date?: string | null
          onset_age?: number | null
          onset_duration_value?: number | null
          onset_duration_unit?: OnsetDurationUnit | null
          is_vigilance?: boolean
          note?: string | null
          display_order?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_practitioner_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      invoice_status: InvoiceStatus
      payment_method: PaymentMethod
      email_template_type: EmailTemplateType
      task_status: TaskStatus
      task_type: TaskType
      audit_action: AuditAction
      medical_history_type: MedicalHistoryType
      onset_duration_unit: OnsetDurationUnit
    }
  }
}

// Helper types for easier usage
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Insertable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updatable<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']

// Aliases for common types
export type Practitioner = Tables<'practitioners'>
export type Patient = Tables<'patients'>
export type Consultation = Tables<'consultations'>
export type Invoice = Tables<'invoices'>
export type Payment = Tables<'payments'>
export type EmailTemplate = Tables<'email_templates'>
export type ScheduledTask = Tables<'scheduled_tasks'>
export type AuditLog = Tables<'audit_logs'>
export type SavedReport = Tables<'saved_reports'>
export type MedicalHistoryEntry = Tables<'medical_history_entries'>

// Extended types with relations
export interface PatientWithConsultations extends Patient {
  consultations: Consultation[]
}

export interface ConsultationWithPatient extends Consultation {
  patient: Patient
}

export interface ConsultationWithInvoice extends Consultation {
  patient: Patient
  invoice: Invoice | null
}

export interface InvoiceWithDetails extends Invoice {
  consultation: ConsultationWithPatient
  payments: Payment[]
}

export interface PaymentWithInvoice extends Payment {
  invoice: InvoiceWithDetails
}
