import fs from 'fs';
import path from 'path';
import { TicketStats, ProjectBreakdown, AssigneeBreakdown, TimeSeriesData } from '@/types/ticket';

interface ProcessedData {
  stats: TicketStats;
  ticketsByMonth: TimeSeriesData[];
  projectBreakdown: ProjectBreakdown[];
  assigneeBreakdown: AssigneeBreakdown[];
  statusBreakdown: { name: string; value: number }[];
  priorityBreakdown: { name: string; value: number }[];
  ticketSample: {
    ticket_key: string;
    ticket_title: string;
    ticket_status: string;
    ticket_priority: string;
    project_name: string;
    assigned_user_name: string;
    ticket_created_at_utc: string;
    time_to_resolution_in_minutes: number | null;
    is_ticket_complete: string;
  }[];
  processedAt: string;
}

let cachedData: ProcessedData | null = null;

function loadProcessedData(): ProcessedData {
  if (cachedData) {
    return cachedData;
  }

  const jsonPath = path.join(process.cwd(), 'data', 'processed-stats.json');
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  cachedData = JSON.parse(jsonContent) as ProcessedData;

  return cachedData;
}

export async function getTicketStats(): Promise<TicketStats> {
  const data = loadProcessedData();
  return data.stats;
}

export async function getTicketsByMonth(): Promise<TimeSeriesData[]> {
  const data = loadProcessedData();
  return data.ticketsByMonth;
}

export async function getProjectBreakdown(): Promise<ProjectBreakdown[]> {
  const data = loadProcessedData();
  return data.projectBreakdown;
}

export async function getAssigneeBreakdown(): Promise<AssigneeBreakdown[]> {
  const data = loadProcessedData();
  return data.assigneeBreakdown;
}

export async function getStatusBreakdown(): Promise<{ name: string; value: number }[]> {
  const data = loadProcessedData();
  return data.statusBreakdown;
}

export async function getPriorityBreakdown(): Promise<{ name: string; value: number }[]> {
  const data = loadProcessedData();
  return data.priorityBreakdown;
}

export async function getTicketSample(limit: number = 100) {
  const data = loadProcessedData();
  return data.ticketSample.slice(0, limit);
}

export async function getAllProcessedData(): Promise<ProcessedData> {
  return loadProcessedData();
}
