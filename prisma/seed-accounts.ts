import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ACCOUNTS = [
  "EY",
  "Fiserv",
  "Royal Bank of Canada",
  "T-Mobile",
  "USAA",
  "PayPal",
  "Nationwide",
  "Amex",
  "Visa",
  "Synchrony",
  "Navy Federal",
  "Liberty Mutual",
  "Lseg",
  "Desjardins",
  "The Kroger Co.",
  "PwC Americas",
  "Charter Product and Technology",
  "Progressive",
  "CVS Health",
  "Adobe",
  "Deloitte Global",
  "Deloitte",
  "Mastercard",
  "Twilio",
  "Atlassian",
  "Manulife",
  "ZEISS Group",
  "SAP SE Enterprise",
  "Meijer",
  "Fox Tech",
  "Marriott",
  "Disney Streaming Services",
  "7-Eleven, Inc.",
  "LPL Financial",
  "corelogic-api",
  "Allstate Insurance Company",
  "Capital Group",
  "Ford",
  "Salesforce-Master Account",
  "Epic Games",
  "BetFanatics.com",
  "Amfam",
  "UPS",
  "CSGI",
  "Alight",
  "WGU",
  "Clover Networks",
  "Guardian Life",
  "Galileo-FT",
  "PwC EMEA",
  "Southern Company",
  "Worldpay",
  "Experian",
  "volvocars",
  "team-sofi",
  "Starbucks",
  "Southwest Airlines",
  "csaa-api-management",
  "Avalara",
  "Chevron",
  "Paylocity",
  "Roblox Corporation",
  "iA",
  "Grubhub",
  "Ulta, Inc.",
  "Warner Bros. Discovery",
  "RCG Digital",
  "Postman lpl-cloud",
  "Coupa Software Inc",
  "Procter and Gamble",
  "Trimble",
  "Moody's Analytics - API",
  "SVB API",
  "Zebra CTO and SBU",
  "Zurich Enterprise",
  "SNCF Connect & Tech",
  "Verizon",
  "Crédit Mutuel Arkea",
  "Chubb",
  "SiriusXM",
  "L'Oréal Beauty Tech",
  "Chick-fil-A",
  "Zillow Group",
  "Sabre",
  "Costco Wholesale",
  "Great American Insurance Group",
  "Service NSW",
  "Proximus",
  "Newline",
  "arvest-bank",
  "API",
  "Pacific Life",
  "VIZIO",
  "Healthfirst",
  "Craft",
  "PagerDuty",
  "Q2 Digital Banking",
  "Uber",
];

async function main() {
  console.log(`Seeding ${ACCOUNTS.length} accounts as unassigned projects...\n`);

  let created = 0;
  let skipped = 0;

  for (const name of ACCOUNTS) {
    const existing = await prisma.project.findFirst({ where: { name } });
    if (existing) {
      console.log(`  SKIP  "${name}" (already exists, id=${existing.id})`);
      skipped++;
      continue;
    }

    const project = await prisma.project.create({
      data: {
        name,
        ownerUserId: null,
        engagementStage: 0,
        status: "active",
      },
    });
    console.log(`  ADD   "${name}" (id=${project.id})`);
    created++;
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (already existed).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
