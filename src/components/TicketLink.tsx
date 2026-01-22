'use client';

import { ExternalLink } from 'lucide-react';

// Azure DevOps URL pattern for searching work items
const ADO_BASE_URL = 'https://cmgfidev.visualstudio.com/_search';

interface TicketLinkProps {
  ticketKey: string;
  className?: string;
  showIcon?: boolean;
  children?: React.ReactNode;
}

/**
 * Generates an Azure DevOps search URL for a ticket
 */
export function getADOUrl(ticketKey: string): string {
  // Extract the numeric ID from ticket keys like "SH-12345" or just use the full key
  const searchText = ticketKey.includes('-')
    ? ticketKey.split('-').pop() // Get numeric part after dash
    : ticketKey;

  return `${ADO_BASE_URL}?text=${encodeURIComponent(searchText || ticketKey)}&type=workitem`;
}

/**
 * Clickable link component that opens the ticket in Azure DevOps
 */
export function TicketLink({ ticketKey, className = '', showIcon = false, children }: TicketLinkProps) {
  if (!ticketKey) return null;

  const url = getADOUrl(ticketKey);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()} // Prevent row click events
      className={`inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors ${className}`}
      title={`Open ${ticketKey} in Azure DevOps`}
    >
      {children || ticketKey}
      {showIcon && <ExternalLink className="h-3 w-3" />}
    </a>
  );
}
