export interface Ticket {
  ticket_created_at_utc: string;
  ticket_updated_at_utc: string;
  org_id: string;
  org_name: string;
  org_status_id: string;
  org_status_name: string;
  project_name: string;
  ticket_priority: string;
  ticket_status: string;
  ticket_type: string;
  ticket_key: string;
  ticket_uuid: string;
  ticket_title: string;
  ticket_description: string;
  ticket_reporter_email: string;
  ticket_reporter_name: string;
  assigned_user_name: string;
  assigned_user_email: string;
  first_response_sent_utc: string;
  time_to_first_response_in_minutes: number | null;
  first_responder_email: string;
  first_responder_name: string;
  latest_response_sent_utc: string;
  latest_responder_email: string;
  latest_responder_name: string;
  due_date_utc: string;
  sla_ever_breached: string;
  first_sla_breached_at_utc: string;
  latest_sla_breached_at_utc: string;
  deleted_at: string;
  delete_reason_name: string;
  is_ticket_complete: string;
  ticket_completed_at_utc: string;
  time_to_resolution_in_minutes: number | null;
  assigned_user_email_when_ticket_completed: string;
  assigned_user_name_when_ticket_completed: string;
  ticket_tags: string;
  custom_fields: string;
}

export interface TicketStats {
  totalTickets: number;
  completedTickets: number;
  openTickets: number;
  avgResponseTimeMinutes: number;
  avgResolutionTimeMinutes: number;
  completionRate: number;
}

export interface ChartData {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface TimeSeriesData {
  date: string;
  count: number;
  [key: string]: string | number;
}

export interface ProjectBreakdown {
  project: string;
  total: number;
  completed: number;
  open: number;
  avgResolutionHours: number;
}

export interface AssigneeBreakdown {
  name: string;
  email: string;
  total: number;
  completed: number;
  avgResolutionHours: number;
}
