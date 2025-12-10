import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

/**
 * Backfill API Endpoint
 *
 * Safely backfills missing transcript fields from provided data
 * Can run in dry-run mode or actual update mode
 */

interface BackfillRecord {
  VendorCallKey: string;
  CallDurationInSeconds?: string;
  CallEndDateTime?: string;
  NumberOfHolds?: string;
  CustomerHoldDuration?: string;
  VoiceCallStatus?: string;
  UserRoleName?: string;
  ProfileName?: string;
  Email?: string;
}

function parseDateTime(dateStr?: string): Date | null {
  if (!dateStr) return null;
  try {
    const timestamp = parseInt(dateStr);
    if (!isNaN(timestamp)) {
      return new Date(timestamp);
    }
    return new Date(dateStr);
  } catch (err) {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { records, dryRun = true } = body as { records: BackfillRecord[]; dryRun?: boolean };

    if (!records || !Array.isArray(records)) {
      return NextResponse.json(
        { success: false, message: 'Invalid request: records array required' },
        { status: 400 }
      );
    }

    console.log(`🔄 Backfill ${dryRun ? 'DRY RUN' : 'WRITE'} mode - Processing ${records.length} records`);

    let updated = 0;
    let skipped = 0;
    const skippedReasons: Record<string, number> = {};
    const updatedFields: Record<string, number> = {};
    const errors: string[] = [];

    // Process each record
    for (const record of records) {
      try {
        const vendorCallKey = record.VendorCallKey;
        if (!vendorCallKey) {
          skipped++;
          skippedReasons['no vendor key'] = (skippedReasons['no vendor key'] || 0) + 1;
          continue;
        }

        // Find existing transcript
        const existing = await prisma.transcripts.findUnique({
          where: { vendor_call_key: vendorCallKey },
        });

        if (!existing) {
          skipped++;
          skippedReasons['not in database'] = (skippedReasons['not in database'] || 0) + 1;
          continue;
        }

        // Build update object with ONLY missing fields
        const updates: any = {};
        let hasUpdates = false;

        // duration_seconds
        if ((existing.duration_seconds === null || existing.duration_seconds === 0) && record.CallDurationInSeconds) {
          const duration = parseInt(record.CallDurationInSeconds);
          if (!isNaN(duration) && duration > 0) {
            updates.duration_seconds = duration;
            hasUpdates = true;
            updatedFields['duration_seconds'] = (updatedFields['duration_seconds'] || 0) + 1;
          }
        }

        // call_end
        if (!existing.call_end && record.CallEndDateTime) {
          const callEnd = parseDateTime(record.CallEndDateTime);
          if (callEnd) {
            updates.call_end = callEnd;
            hasUpdates = true;
            updatedFields['call_end'] = (updatedFields['call_end'] || 0) + 1;
          }
        }

        // number_of_holds
        if (existing.number_of_holds === null && record.NumberOfHolds) {
          const holds = parseInt(record.NumberOfHolds);
          if (!isNaN(holds)) {
            updates.number_of_holds = holds;
            hasUpdates = true;
            updatedFields['number_of_holds'] = (updatedFields['number_of_holds'] || 0) + 1;
          }
        }

        // hold_duration
        if (existing.hold_duration === null && record.CustomerHoldDuration) {
          const holdDuration = parseInt(record.CustomerHoldDuration);
          if (!isNaN(holdDuration)) {
            updates.hold_duration = holdDuration;
            hasUpdates = true;
            updatedFields['hold_duration'] = (updatedFields['hold_duration'] || 0) + 1;
          }
        }

        // status
        if (!existing.status && record.VoiceCallStatus) {
          updates.status = record.VoiceCallStatus;
          hasUpdates = true;
          updatedFields['status'] = (updatedFields['status'] || 0) + 1;
        }

        // agent_role
        if (!existing.agent_role && record.UserRoleName) {
          updates.agent_role = record.UserRoleName;
          hasUpdates = true;
          updatedFields['agent_role'] = (updatedFields['agent_role'] || 0) + 1;
        }

        // agent_profile
        if (!existing.agent_profile && record.ProfileName) {
          updates.agent_profile = record.ProfileName;
          hasUpdates = true;
          updatedFields['agent_profile'] = (updatedFields['agent_profile'] || 0) + 1;
        }

        // agent_email
        if (!existing.agent_email && record.Email) {
          updates.agent_email = record.Email;
          hasUpdates = true;
          updatedFields['agent_email'] = (updatedFields['agent_email'] || 0) + 1;
        }

        // If no updates needed, skip
        if (!hasUpdates) {
          skipped++;
          skippedReasons['already complete'] = (skippedReasons['already complete'] || 0) + 1;
          continue;
        }

        // Perform update (unless dry run)
        if (!dryRun) {
          await prisma.transcripts.update({
            where: { vendor_call_key: vendorCallKey },
            data: updates,
          });
        }

        updated++;
      } catch (err: any) {
        errors.push(`Error processing ${record.VendorCallKey}: ${err.message}`);
        if (errors.length > 10) break; // Stop after 10 errors
      }
    }

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        total: records.length,
        updated,
        skipped,
        errors: errors.length,
      },
      skippedReasons,
      updatedFields,
      errors: errors.slice(0, 10), // Return max 10 errors
    });
  } catch (error: any) {
    console.error('Backfill error:', error);
    return NextResponse.json(
      {
        success: false,
        message: `Backfill failed: ${error.message}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Backfill API - POST raw data records to backfill missing fields',
    usage: {
      method: 'POST',
      body: {
        records: 'Array of records with VendorCallKey and other fields',
        dryRun: 'boolean (default: true) - set to false to actually update',
      },
    },
  });
}
