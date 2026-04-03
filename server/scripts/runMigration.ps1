# Windows PowerShell runner for resetE2EStatus.js
# ─────────────────────────────────────────────────
# Usage: Right-click this file → "Run with PowerShell"
# OR paste into PowerShell terminal from the /server folder:
#   .\scripts\runMigration.ps1
#
# INSTRUCTIONS:
#   1. Paste your full MongoDB URI between the quotes on the next line
#   2. Run this script from your /server directory

$env:MONGO_URI = "mongodb+srv://orsasson1407_db_user:i0CmesYG4fo3Oa22@cluster0.au09plh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"

node scripts/resetE2EStatus.js