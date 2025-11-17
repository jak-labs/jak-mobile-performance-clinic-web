# Cleanup Duplicate Subjects in DynamoDB

## Problem
When clients signed up with an invite token, two records were created:
1. One with `owner_id = coachId` (correct - assigned to coach)
2. One with `owner_id = subject_id` (duplicate - self-owned, appears as unassigned)

## Solution
Delete the duplicate records where `owner_id === subject_id` for clients who have an assigned record (where `owner_id !== subject_id`).

## Manual Cleanup Steps

1. **Identify duplicates:**
   - Find all records where `owner_id === subject_id` (self-owned)
   - For each, check if there's another record with the same `subject_id` but different `owner_id`
   - If yes, that's a duplicate that should be deleted

2. **Delete duplicates in AWS Console:**
   - Go to DynamoDB → Tables → `jak-subjects`
   - For each duplicate:
     - Find the record where `owner_id = subject_id` (the duplicate)
     - Delete it, keeping only the record where `owner_id = coachId`

## Example
If you see:
- Record 1: `owner_id = "coach-id-123"`, `subject_id = "member-id-456"` ✅ Keep this
- Record 2: `owner_id = "member-id-456"`, `subject_id = "member-id-456"` ❌ Delete this

## Prevention
The code has been fixed to check for existing profiles before creating new ones during email verification. This prevents new duplicates from being created.

