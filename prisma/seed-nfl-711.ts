import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

function makeId(prefix: string): string {
  return `seed-${prefix}-${Date.now().toString(36)}`;
}

async function createChunksForProject(
  projectId: string,
  documents: Array<{ source: string; title: string; rawText: string }>
) {
  const chunkIds: string[] = [];
  const chunksBySource: Record<string, number> = {};

  for (let i = 0; i < documents.length; i++) {
    const item = documents[i];
    const docId = makeId(`doc-${projectId.slice(-6)}-${i}`);
    const contentHash = crypto.createHash("sha256").update(item.rawText).digest("hex");

    await prisma.sourceDocument.create({
      data: {
        id: docId,
        projectId,
        sourceType: item.source,
        title: item.title,
        rawText: item.rawText,
        contentHash,
        metadataJson: { originalSource: item.source },
      },
    });

    const numChunks = item.rawText.length > 300 ? 2 : 1;
    for (let c = 0; c < numChunks; c++) {
      const chunkId = makeId(`chunk-${projectId.slice(-6)}-${i}-${c}`);
      const evidenceLabel = `EVIDENCE-${chunkIds.length + 1}`;
      const content = c === 0 ? item.rawText : item.rawText.substring(0, Math.floor(item.rawText.length / 2));

      const seed = crypto.createHash("md5").update(chunkId).digest();
      const vectorValues = Array.from({ length: 3072 }, (_, idx) => {
        const byte = seed[idx % seed.length];
        return ((byte / 255) * 2 - 1).toFixed(6);
      });
      const vectorStr = `[${vectorValues.join(",")}]`;

      await prisma.$executeRawUnsafe(
        `INSERT INTO "DocumentChunk" (id, "documentId", "projectId", content, embedding, "tokenCount", "evidenceLabel", "createdAt")
         VALUES ($1, $2, $3, $4, $5::vector, $6, $7, NOW())`,
        chunkId,
        docId,
        projectId,
        content,
        vectorStr,
        Math.floor(content.length / 4),
        evidenceLabel
      );

      chunkIds.push(chunkId);
      chunksBySource[item.source] = (chunksBySource[item.source] || 0) + 1;
    }
  }

  const snapshotHash = crypto.createHash("sha256").update(JSON.stringify(chunkIds.sort())).digest("hex");
  await prisma.evidenceSnapshot.create({
    data: {
      projectId,
      chunkIdsJson: chunkIds,
      countsJson: { bySource: chunksBySource, total: chunkIds.length },
      hash: snapshotHash,
    },
  });

  return { chunkCount: chunkIds.length, docCount: documents.length };
}

async function main() {
  console.log("Seeding NFL project for Daniel...\n");

  const daniel = await prisma.user.findUnique({ where: { email: "daniel@postman.com" } });

  if (!daniel) {
    console.error("Daniel user not found. Run the fleet seed first.");
    process.exit(1);
  }

  const hammad = await prisma.user.findUnique({ where: { email: "hammad@postman.com" } });

  // =========================================================================
  // NFL PROJECT FOR DANIEL
  // =========================================================================

  const existingNfl = await prisma.project.findFirst({
    where: { name: { contains: "NFL", mode: "insensitive" }, ownerUserId: daniel.id },
  });
  if (existingNfl) {
    await prisma.project.delete({ where: { id: existingNfl.id } });
    console.log(`  Deleted existing NFL project: ${existingNfl.id}`);
  }

  const nflServiceTemplate = `openapi: "3.0.3"
info:
  title: NFL Platform APIs
  version: 3.2.0
  description: >
    Unified API platform for NFL digital properties — covering live game stats,
    fantasy football, partner integrations, and content delivery.
    Serves 300+ partner organizations and 50M+ fantasy players.
  contact:
    name: NFL API Platform Team
    email: api-platform@nfl.com
  license:
    name: NFL Partner License
    url: https://developer.nfl.com/terms
servers:
  - url: https://api.nfl.com/v3
    description: Production
  - url: https://api-staging.nfl.com/v3
    description: Staging
  - url: https://api-dev.nfl.com/v3
    description: Development
  - url: https://api-sandbox.nfl.com/v3
    description: Partner Sandbox
security:
  - OAuth2: [stats.read, fantasy.read]
  - PartnerApiKey: []
tags:
  - name: Stats
    description: Real-time and historical game statistics (80% of partner traffic)
  - name: Fantasy
    description: Fantasy football player projections, scores, and rosters
  - name: Games
    description: Live game status, schedules, and scoring
  - name: Players
    description: Player profiles, rosters, and injury reports
  - name: Partners
    description: Partner onboarding, SDK access, and usage analytics
  - name: Content
    description: Video highlights, articles, and media assets
paths:
  /stats/games/{gameId}/live:
    get:
      operationId: getLiveGameStats
      summary: Get real-time game statistics
      description: >
        Returns live play-by-play stats including Next Gen Stats player tracking
        data powered by AWS Sagemaker. Averages 500K+ calls/min during peak game windows.
      tags: [Stats]
      parameters:
        - name: gameId
          in: path
          required: true
          schema: { type: string, example: "2026-REG-WK01-KC-BAL" }
        - name: include
          in: query
          description: Comma-separated list of stat groups to include
          schema:
            type: string
            example: "passing,rushing,receiving,ngs"
        - name: quarter
          in: query
          schema: { type: integer, minimum: 1, maximum: 5 }
      responses:
        "200":
          description: Live game stats
          content:
            application/json:
              schema: { $ref: "#/components/schemas/LiveGameStats" }
        "404":
          description: Game not found
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Error" }
  /stats/players/{playerId}/season:
    get:
      operationId: getPlayerSeasonStats
      summary: Get player season statistics
      tags: [Stats]
      parameters:
        - name: playerId
          in: path
          required: true
          schema: { type: string, example: "PM-00d9b" }
        - name: season
          in: query
          required: true
          schema: { type: integer, example: 2026 }
        - name: seasonType
          in: query
          schema:
            type: string
            enum: [preseason, regular, postseason]
            default: regular
      responses:
        "200":
          description: Player season stats
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PlayerSeasonStats" }
  /stats/leaders:
    get:
      operationId: getStatLeaders
      summary: Get league statistical leaders
      tags: [Stats]
      parameters:
        - name: category
          in: query
          required: true
          schema:
            type: string
            enum: [passing_yards, rushing_yards, receiving_yards, touchdowns, interceptions, sacks, passer_rating]
        - name: season
          in: query
          schema: { type: integer, example: 2026 }
        - name: week
          in: query
          schema: { type: integer, minimum: 1, maximum: 22 }
        - name: limit
          in: query
          schema: { type: integer, default: 10, maximum: 50 }
      responses:
        "200":
          description: Statistical leaders
          content:
            application/json:
              schema:
                type: object
                properties:
                  category: { type: string }
                  leaders:
                    type: array
                    items: { $ref: "#/components/schemas/StatLeader" }
                  pagination: { $ref: "#/components/schemas/Pagination" }
  /games/schedule:
    get:
      operationId: getSchedule
      summary: Get game schedule
      tags: [Games]
      parameters:
        - name: season
          in: query
          required: true
          schema: { type: integer, example: 2026 }
        - name: seasonType
          in: query
          schema:
            type: string
            enum: [preseason, regular, postseason]
        - name: week
          in: query
          schema: { type: integer, minimum: 1, maximum: 22 }
        - name: teamId
          in: query
          schema: { type: string, example: "KC" }
      responses:
        "200":
          description: Game schedule
          content:
            application/json:
              schema:
                type: object
                properties:
                  games:
                    type: array
                    items: { $ref: "#/components/schemas/Game" }
                  pagination: { $ref: "#/components/schemas/Pagination" }
  /games/{gameId}/scoring:
    get:
      operationId: getGameScoring
      summary: Get scoring summary for a game
      description: >
        Detailed scoring plays. For real-time push updates,
        connect to ws.nfl.com via WebSocket with your partner credentials.
      tags: [Games]
      parameters:
        - name: gameId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: Scoring summary
          content:
            application/json:
              schema: { $ref: "#/components/schemas/ScoringSummary" }
  /players:
    get:
      operationId: listPlayers
      summary: List players with filtering
      tags: [Players]
      parameters:
        - name: teamId
          in: query
          schema: { type: string, example: "KC" }
        - name: position
          in: query
          schema:
            type: string
            enum: [QB, RB, WR, TE, K, DEF, OL, DL, LB, DB]
        - name: status
          in: query
          schema:
            type: string
            enum: [active, injured_reserve, practice_squad, free_agent]
        - name: limit
          in: query
          schema: { type: integer, default: 25, maximum: 100 }
        - name: cursor
          in: query
          schema: { type: string }
      responses:
        "200":
          description: Paginated player list
          content:
            application/json:
              schema:
                type: object
                properties:
                  players:
                    type: array
                    items: { $ref: "#/components/schemas/Player" }
                  pagination: { $ref: "#/components/schemas/CursorPagination" }
  /players/{playerId}:
    get:
      operationId: getPlayer
      summary: Get player profile and details
      tags: [Players]
      parameters:
        - name: playerId
          in: path
          required: true
          schema: { type: string }
        - name: include
          in: query
          description: "Extra data to include: stats, injuries, ngs"
          schema: { type: string }
      responses:
        "200":
          description: Player details
          content:
            application/json:
              schema: { $ref: "#/components/schemas/Player" }
  /players/{playerId}/injuries:
    get:
      operationId: getPlayerInjuries
      summary: Get player injury report history
      tags: [Players]
      parameters:
        - name: playerId
          in: path
          required: true
          schema: { type: string }
        - name: season
          in: query
          schema: { type: integer }
      responses:
        "200":
          description: Injury report
          content:
            application/json:
              schema:
                type: object
                properties:
                  playerId: { type: string }
                  injuries:
                    type: array
                    items: { $ref: "#/components/schemas/InjuryReport" }
  /fantasy/projections:
    get:
      operationId: getFantasyProjections
      summary: Get fantasy point projections
      description: Projections for 50M+ fantasy football players. High traffic during draft season.
      tags: [Fantasy]
      parameters:
        - name: week
          in: query
          required: true
          schema: { type: integer, minimum: 1, maximum: 22 }
        - name: position
          in: query
          schema:
            type: string
            enum: [QB, RB, WR, TE, K, DEF]
        - name: scoringFormat
          in: query
          schema:
            type: string
            enum: [standard, ppr, half_ppr]
            default: ppr
        - name: limit
          in: query
          schema: { type: integer, default: 50, maximum: 200 }
      responses:
        "200":
          description: Fantasy projections
          content:
            application/json:
              schema:
                type: object
                properties:
                  week: { type: integer }
                  scoringFormat: { type: string }
                  projections:
                    type: array
                    items: { $ref: "#/components/schemas/FantasyProjection" }
                  pagination: { $ref: "#/components/schemas/Pagination" }
  /fantasy/scores:
    get:
      operationId: getFantasyScores
      summary: Get live fantasy point scores
      tags: [Fantasy]
      parameters:
        - name: week
          in: query
          required: true
          schema: { type: integer }
        - name: scoringFormat
          in: query
          schema:
            type: string
            enum: [standard, ppr, half_ppr]
            default: ppr
        - name: playerIds
          in: query
          description: Comma-separated player IDs (max 50)
          schema: { type: string }
      responses:
        "200":
          description: Fantasy scores
          content:
            application/json:
              schema:
                type: object
                properties:
                  scores:
                    type: array
                    items: { $ref: "#/components/schemas/FantasyScore" }
  /fantasy/adp:
    get:
      operationId: getAverageDraftPosition
      summary: Get average draft position rankings
      tags: [Fantasy]
      parameters:
        - name: scoringFormat
          in: query
          schema:
            type: string
            enum: [standard, ppr, half_ppr]
            default: ppr
        - name: leagueSize
          in: query
          schema: { type: integer, enum: [8, 10, 12, 14], default: 12 }
        - name: limit
          in: query
          schema: { type: integer, default: 200, maximum: 500 }
      responses:
        "200":
          description: ADP rankings
          content:
            application/json:
              schema:
                type: object
                properties:
                  adpRankings:
                    type: array
                    items: { $ref: "#/components/schemas/AdpRanking" }
  /partners/register:
    post:
      operationId: registerPartner
      summary: Register a new partner application
      description: >
        Self-service partner registration endpoint. Currently onboarding takes
        6-8 weeks (target: 2 weeks). Includes API key provisioning and sandbox access.
      tags: [Partners]
      security:
        - OAuth2: [partners.write]
      requestBody:
        required: true
        content:
          application/json:
            schema: { $ref: "#/components/schemas/PartnerRegistration" }
      responses:
        "201":
          description: Partner registered
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PartnerCredentials" }
        "409":
          description: Partner org already registered
  /partners/{partnerId}/usage:
    get:
      operationId: getPartnerUsage
      summary: Get partner API usage analytics
      tags: [Partners]
      security:
        - OAuth2: [partners.read]
      parameters:
        - name: partnerId
          in: path
          required: true
          schema: { type: string }
        - name: startDate
          in: query
          required: true
          schema: { type: string, format: date }
        - name: endDate
          in: query
          required: true
          schema: { type: string, format: date }
        - name: granularity
          in: query
          schema:
            type: string
            enum: [hourly, daily, weekly]
            default: daily
      responses:
        "200":
          description: Usage analytics
          content:
            application/json:
              schema: { $ref: "#/components/schemas/PartnerUsage" }
  /content/highlights/{gameId}:
    get:
      operationId: getGameHighlights
      summary: Get video highlight clips for a game
      tags: [Content]
      parameters:
        - name: gameId
          in: path
          required: true
          schema: { type: string }
        - name: type
          in: query
          schema:
            type: string
            enum: [touchdown, turnover, big_play, all]
            default: all
      responses:
        "200":
          description: Highlight clips
          content:
            application/json:
              schema:
                type: object
                properties:
                  highlights:
                    type: array
                    items: { $ref: "#/components/schemas/Highlight" }
components:
  schemas:
    LiveGameStats:
      type: object
      properties:
        gameId: { type: string }
        status: { type: string, enum: [scheduled, pregame, in_progress, halftime, final, final_overtime] }
        quarter: { type: integer }
        clock: { type: string, example: "04:32" }
        possession: { type: string, example: "KC" }
        homeTeam: { $ref: "#/components/schemas/TeamGameStats" }
        awayTeam: { $ref: "#/components/schemas/TeamGameStats" }
        lastPlay: { $ref: "#/components/schemas/Play" }
        nextGenStats:
          type: object
          description: AWS Sagemaker-powered player tracking data
          properties:
            completionProbability: { type: number, format: double }
            expectedYardsAfterCatch: { type: number, format: double }
            rushYardsOverExpected: { type: number, format: double }
    TeamGameStats:
      type: object
      properties:
        teamId: { type: string, example: "KC" }
        teamName: { type: string, example: "Kansas City Chiefs" }
        score: { type: integer }
        timeOfPossession: { type: string }
        totalYards: { type: integer }
        passingYards: { type: integer }
        rushingYards: { type: integer }
        turnovers: { type: integer }
        penalties: { type: integer }
        penaltyYards: { type: integer }
    Play:
      type: object
      properties:
        playId: { type: string }
        quarter: { type: integer }
        clock: { type: string }
        down: { type: integer }
        yardsToGo: { type: integer }
        yardLine: { type: string }
        description: { type: string }
        playType: { type: string, enum: [pass, rush, punt, kickoff, field_goal, penalty, timeout] }
        yardsGained: { type: integer }
    PlayerSeasonStats:
      type: object
      properties:
        playerId: { type: string }
        playerName: { type: string }
        teamId: { type: string }
        position: { type: string }
        season: { type: integer }
        gamesPlayed: { type: integer }
        passing:
          type: object
          properties:
            attempts: { type: integer }
            completions: { type: integer }
            yards: { type: integer }
            touchdowns: { type: integer }
            interceptions: { type: integer }
            rating: { type: number, format: double }
        rushing:
          type: object
          properties:
            attempts: { type: integer }
            yards: { type: integer }
            touchdowns: { type: integer }
            yardsPerAttempt: { type: number, format: double }
        receiving:
          type: object
          properties:
            targets: { type: integer }
            receptions: { type: integer }
            yards: { type: integer }
            touchdowns: { type: integer }
            yardsPerReception: { type: number, format: double }
    StatLeader:
      type: object
      properties:
        rank: { type: integer }
        playerId: { type: string }
        playerName: { type: string }
        teamId: { type: string }
        position: { type: string }
        value: { type: number }
    Game:
      type: object
      properties:
        gameId: { type: string }
        season: { type: integer }
        seasonType: { type: string }
        week: { type: integer }
        homeTeamId: { type: string }
        awayTeamId: { type: string }
        homeScore: { type: integer, nullable: true }
        awayScore: { type: integer, nullable: true }
        status: { type: string, enum: [scheduled, in_progress, final, postponed] }
        venue: { type: string }
        startTime: { type: string, format: date-time }
        broadcastNetwork: { type: string }
    ScoringSummary:
      type: object
      properties:
        gameId: { type: string }
        scoringPlays:
          type: array
          items:
            type: object
            properties:
              quarter: { type: integer }
              clock: { type: string }
              teamId: { type: string }
              description: { type: string }
              scoreType: { type: string, enum: [touchdown, field_goal, safety, extra_point, two_point_conversion] }
              points: { type: integer }
              homeScore: { type: integer }
              awayScore: { type: integer }
    Player:
      type: object
      properties:
        playerId: { type: string }
        firstName: { type: string }
        lastName: { type: string }
        position: { type: string }
        jerseyNumber: { type: integer }
        teamId: { type: string }
        teamName: { type: string }
        height: { type: string, example: "6-2" }
        weight: { type: integer }
        age: { type: integer }
        college: { type: string }
        draftYear: { type: integer }
        draftRound: { type: integer }
        draftPick: { type: integer }
        status: { type: string, enum: [active, injured_reserve, practice_squad, free_agent, retired] }
        headshotUrl: { type: string, format: uri }
    InjuryReport:
      type: object
      properties:
        reportDate: { type: string, format: date }
        week: { type: integer }
        injury: { type: string }
        practiceStatus: { type: string, enum: [full_participation, limited, did_not_participate] }
        gameStatus: { type: string, enum: [probable, questionable, doubtful, out] }
    FantasyProjection:
      type: object
      properties:
        playerId: { type: string }
        playerName: { type: string }
        teamId: { type: string }
        position: { type: string }
        projectedPoints: { type: number, format: double }
        projectedPassYards: { type: number, nullable: true }
        projectedRushYards: { type: number, nullable: true }
        projectedRecYards: { type: number, nullable: true }
        projectedTouchdowns: { type: number, format: double }
        opponent: { type: string }
        confidence: { type: number, format: double, minimum: 0, maximum: 1 }
    FantasyScore:
      type: object
      properties:
        playerId: { type: string }
        playerName: { type: string }
        teamId: { type: string }
        position: { type: string }
        points: { type: number, format: double }
        breakdown:
          type: object
          properties:
            passingYards: { type: number }
            passingTouchdowns: { type: number }
            rushingYards: { type: number }
            rushingTouchdowns: { type: number }
            receptions: { type: number }
            receivingYards: { type: number }
            receivingTouchdowns: { type: number }
            interceptions: { type: number }
            fumbles: { type: number }
        gameStatus: { type: string, enum: [not_started, in_progress, final] }
    AdpRanking:
      type: object
      properties:
        rank: { type: integer }
        playerId: { type: string }
        playerName: { type: string }
        position: { type: string }
        teamId: { type: string }
        averagePick: { type: number, format: double }
        minPick: { type: integer }
        maxPick: { type: integer }
        positionRank: { type: integer }
    PartnerRegistration:
      type: object
      required: [orgName, contactEmail, useCase, estimatedDailyVolume]
      properties:
        orgName: { type: string, example: "ESPN" }
        contactEmail: { type: string, format: email }
        useCase:
          type: string
          enum: [media, fantasy_platform, betting, analytics, team_app, other]
        estimatedDailyVolume: { type: integer }
        webhookUrl: { type: string, format: uri }
        requestedScopes:
          type: array
          items: { type: string }
    PartnerCredentials:
      type: object
      properties:
        partnerId: { type: string, format: uuid }
        apiKey: { type: string }
        clientId: { type: string }
        clientSecret: { type: string }
        tier: { type: string, enum: [basic, standard, premium, enterprise] }
        rateLimitPerMinute: { type: integer }
        sandboxBaseUrl: { type: string, format: uri }
        expiresAt: { type: string, format: date-time }
    PartnerUsage:
      type: object
      properties:
        partnerId: { type: string }
        period: { type: object, properties: { start: { type: string, format: date }, end: { type: string, format: date } } }
        totalRequests: { type: integer }
        successRate: { type: number, format: double }
        averageLatencyMs: { type: number, format: double }
        topEndpoints:
          type: array
          items:
            type: object
            properties:
              endpoint: { type: string }
              calls: { type: integer }
              avgLatencyMs: { type: number }
        dataPoints:
          type: array
          items:
            type: object
            properties:
              timestamp: { type: string, format: date-time }
              requests: { type: integer }
              errors: { type: integer }
              p50LatencyMs: { type: number }
              p99LatencyMs: { type: number }
    Highlight:
      type: object
      properties:
        clipId: { type: string }
        gameId: { type: string }
        type: { type: string }
        title: { type: string }
        description: { type: string }
        durationSeconds: { type: integer }
        thumbnailUrl: { type: string, format: uri }
        videoUrl: { type: string, format: uri }
        quarter: { type: integer }
        clock: { type: string }
        createdAt: { type: string, format: date-time }
    Pagination:
      type: object
      properties:
        total: { type: integer }
        page: { type: integer }
        perPage: { type: integer }
        hasMore: { type: boolean }
    CursorPagination:
      type: object
      properties:
        nextCursor: { type: string, nullable: true }
        prevCursor: { type: string, nullable: true }
        hasMore: { type: boolean }
    Error:
      type: object
      properties:
        code: { type: string }
        message: { type: string }
        details: { type: object }
        requestId: { type: string }
  securitySchemes:
    OAuth2:
      type: oauth2
      flows:
        clientCredentials:
          tokenUrl: https://auth.nfl.com/oauth/token
          scopes:
            stats.read: Read game and player statistics
            fantasy.read: Read fantasy football data
            fantasy.write: Manage fantasy rosters
            partners.read: Read partner account data
            partners.write: Manage partner registrations
            content.read: Access media content and highlights
    PartnerApiKey:
      type: apiKey
      in: header
      name: X-NFL-API-Key`;

  const nflProject = await prisma.project.create({
    data: {
      name: "NFL",
      primaryDomain: "nfl.com",
      apiDomain: "api.nfl.com",
      publicWorkspaceUrl: "https://www.postman.com/nfl/workspace/nfl-public-apis",
      customerContactName: "Brian Rolapp (CTO)",
      customerContactEmail: "brian.rolapp@nfl.com",
      ownerUserId: daniel.id,
      isPinned: true,
      engagementStage: 3,
      serviceTemplateContent: nflServiceTemplate,
      serviceTemplateType: "openapi",
      serviceTemplateFileName: "nfl-platform-apis-v3.yaml",
      serviceTemplateNotes: "Comprehensive NFL Platform API spec covering Stats (80% of partner traffic), Fantasy (50M+ users), Games, Players, Partner management, and Content. Obtained from Jason Rivera (Director of API Platform) during discovery. Auth via OAuth2 client credentials or partner API key. Real-time scoring also available via WebSocket at ws.nfl.com (not in this spec).",
    },
  });

  const nflDocs = [
    { source: "KEPLER", title: "NFL Kepler account overview", rawText: "NFL (National Football League) — Major US sports league with $20B+ annual revenue. 32 franchise teams. Headquartered in New York City. 345 million fans in the US. Major digital transformation led by CTO Brian Rolapp. NFL Media division operates NFL.com, NFL App, NFL+, and NFL Network. Engineering org: ~600 engineers across NFL HQ, NFL Media, and NFL Digital. Stadium operations technology team of 80+ people. GameDay operations involve real-time data feeds from all 30+ stadiums simultaneously." },
    { source: "KEPLER", title: "NFL technology stack and platform notes", rawText: "Primary cloud: AWS (confirmed via CloudFront headers on nfl.com). Secondary: Azure for Teams/Office integrations. NFL uses Next Gen Stats powered by AWS Sagemaker for real-time player tracking data. API Gateway: Apigee (Google) for external partner APIs. Internal services use gRPC + REST mix. CDN: Akamai for media delivery, CloudFront for web properties. Database: PostgreSQL on RDS, DynamoDB for real-time stats, Redis for caching. Streaming infrastructure: AWS Elemental MediaLive for NFL+ streaming to 30M+ subscribers. Kubernetes (EKS) for microservices. Average game day generates 500K+ API calls per minute during peak." },
    { source: "KEPLER", title: "NFL API platform initiative details", rawText: "NFL is building a unified API platform to serve 300+ partner integrations (ESPN, Yahoo Sports, betting platforms, fantasy sports). Currently managing 45+ public APIs and 200+ internal APIs. Partner API access generates significant licensing revenue. Pain points: inconsistent API documentation across teams, no centralized testing strategy, partner onboarding takes 6-8 weeks instead of target 2 weeks. NFL wants to standardize API contracts and reduce partner integration time. Current partner developer portal at developer.nfl.com built on custom React app. API governance is fragmented - each team has own standards." },
    { source: "KEPLER", title: "NFL developer portal and API documentation findings", rawText: "Developer portal at developer.nfl.com serves 300+ partner organizations. Portal built on custom React/Node.js stack. 45 public APIs documented with varying quality. Stats API is the most consumed (80% of all partner calls). Real-time scoring API requires WebSocket connections. Fantasy API serves 50M+ fantasy football players during season. API key management via custom-built portal. No Postman workspace detected publicly. Partner sandbox environment exists but frequently out of sync with production. Average API documentation quality score: 6/10 (internal audit). OpenAPI specs exist for ~60% of APIs." },
    { source: "KEPLER", title: "NFL engineering org structure and key contacts", rawText: "CTO: Brian Rolapp. VP Platform Engineering: Michelle McKenna-Doyle. Director of API Platform: Jason Rivera (primary technical contact). Head of Partner Integrations: Tom Park. Security Lead: David Kim (CISO office). 600 total engineers. Platform team: 45 engineers. Partner integration team: 20 engineers. GameDay operations: 80 engineers. Media/streaming: 120 engineers. Mobile team: 60 engineers. QA team: 35 engineers. Infrastructure: 40 engineers. Key initiative: 'API First' mandate from CTO for FY2026." },
    { source: "KEPLER", title: "NFL compliance and security requirements", rawText: "PCI-DSS compliance for NFL Shop and ticketing APIs. SOC 2 Type II certified. Partner data sharing agreements require API audit trails. COPPA compliance for youth-targeted APIs. Data residency requirements for international partners (NFL International). Gambling/betting APIs require additional regulatory compliance in each state. Real-time data feeds must maintain 99.99% uptime during games. Security requirements: OAuth 2.0 for all partner APIs, API key rotation every 90 days, rate limiting per partner tier, DDoS protection mandatory." },
    { source: "DNS", title: "nfl.com DNS analysis", rawText: "A records point to Akamai CDN (23.x range). CNAME api.nfl.com -> Apigee Gateway. MX: Google Workspace. SPF includes amazonses.com and google.com. developer.nfl.com CNAME -> custom EKS deployment. TLS 1.3 on all endpoints. HSTS enabled. Certificate issued by DigiCert. Subdomains found: api.nfl.com, developer.nfl.com, stats.nfl.com, fantasy.nfl.com, gameday.nfl.com, nflplus.nfl.com, shop.nfl.com." },
    { source: "DNS", title: "api.nfl.com endpoint analysis", rawText: "Apigee gateway detected. Rate limiting headers present (X-RateLimit-Limit, X-RateLimit-Remaining). OAuth 2.0 token endpoint at auth.nfl.com/oauth/token. API versioning via URL path (/v3/). Response headers include X-Request-ID for tracing. Average response time: 45ms (cached), 200ms (uncached). GraphQL endpoint detected at api.nfl.com/graphql for stats data. WebSocket endpoint at ws.nfl.com for real-time scoring." },
    { source: "MANUAL", title: "Meeting notes: Initial discovery call with NFL", rawText: "Met with Jason Rivera (Director of API Platform) and Tom Park (Head of Partner Integrations). Key pain points: 1) Partner onboarding takes 6-8 weeks — too slow, target is 2 weeks. 2) No centralized contract testing — each of 45 APIs tested independently. 3) API documentation inconsistency causing partner support tickets (200+/month). 4) GameDay API testing must happen in real-time simulation environment — current setup is fragile. 5) Fantasy API needs load testing for 50M+ user base during draft season. Jason is champion — already using Postman personally. Tom wants automated partner SDK generation from API specs." },
    { source: "MANUAL", title: "Meeting notes: Security review with NFL CISO team", rawText: "David Kim (CISO) requires: all API testing tools must pass SOC 2 audit. No production credentials in testing tools. Secrets must integrate with their existing AWS Secrets Manager setup. API key rotation enforcement. Audit logs for all API interactions. Postman Enterprise SSO via Okta required. Data residency: all testing data must remain in US-East region. Gambling API testing requires additional data isolation." },
    { source: "GITHUB", title: "NFL api-platform repo analysis", rawText: "Monorepo: nfl-digital/api-platform. 200+ microservices. Language breakdown: Java 40%, Node.js 35%, Python 15%, Go 10%. CI/CD: GitHub Actions + custom deployment tooling. Test coverage: 58% average. Newman used in 12 of 200 pipelines. No contract testing. No mock servers in CI. Average CI pipeline time: 12 minutes. 15 Postman collections found in scattered repos but no central collection management." },
    { source: "GITHUB", title: "NFL partner-sdk repo analysis", rawText: "Partner SDKs generated manually in JavaScript, Python, and Java. Last updated 4 months ago. 23 open issues about outdated SDK methods. No automated SDK generation from OpenAPI specs. SDK documentation lives in README files. No integration tests for SDKs. Partner feedback: SDKs are unreliable and often lag behind API changes by weeks." },
  ];

  const nflStats = await createChunksForProject(nflProject.id, nflDocs);

  await prisma.discoveryArtifact.create({
    data: {
      projectId: nflProject.id,
      version: 1,
      keplerPaste: "NFL (National Football League) — Largest professional sports league in the US. $20B+ annual revenue, 32 franchise teams, 345 million US fans. Digital: NFL.com, NFL App, NFL+ (30M subscribers), NFL Network. CTO Brian Rolapp driving 'API First' transformation. 600+ engineers. 45+ public APIs and 200+ internal APIs serving 300+ partner organizations. Partner onboarding takes 6-8 weeks (target: 2 weeks). No centralized API testing. Inconsistent documentation. 6% Newman adoption (12/200 pipelines).",
      dnsFindings: "Primary domain behind Akamai CDN. API gateway running Apigee. Auth at auth.nfl.com. Developer portal on EKS. TLS 1.3, HSTS everywhere. Subdomains: api, developer, stats, fantasy, gameday, nflplus, shop. GraphQL at api.nfl.com/graphql. WebSocket at ws.nfl.com.",
      headerFindings: "Rate limiting headers. X-Request-ID for tracing. API versioning via URL path (/v3/). OAuth bearer token auth. 45ms cached, 200ms uncached response times.",
      publicFootprint: "developer.nfl.com with 45 public APIs. Stats API 80% of traffic. Fantasy API serves 50M+. 300+ partner orgs. No public Postman workspace. OpenAPI specs for ~60% of APIs.",
      authForensics: "Custom OAuth 2.0, API keys per partner tier, JWT tokens, Okta SSO. AWS Secrets Manager. Key rotation every 90 days.",
      cloudGatewaySignals: "AWS (Akamai, EKS, RDS, DynamoDB, Sagemaker). Apigee gateway. gRPC + REST. Redis caching. AWS Elemental for streaming. 500K+ API calls/min during games.",
      developerFrictionSignals: "6% Newman adoption (12/200 pipelines). No contract testing. No mock servers. 15 scattered collections. 200+ partner support tickets/month. Partner SDKs 4 months stale. 6-8 week partner onboarding.",
      evidenceLinksJson: JSON.stringify([{ label: "Developer Portal", url: "https://developer.nfl.com" }, { label: "NFL Stats API", url: "https://api.nfl.com/v3/stats" }]),
      industry: "Sports & Entertainment / Media",
      engineeringSize: "600+ engineers across NFL HQ, Media, Digital, and GameDay",
      publicApiPresence: "Yes",
      technicalLandscapeJson: JSON.stringify([
        { signal: "Primary Cloud", finding: "AWS (Akamai, EKS, RDS, DynamoDB)", evidence: "DNS, headers, Kepler", confidence: "High" },
        { signal: "CDN / Edge", finding: "Akamai for media, CloudFront for web", evidence: "DNS A records", confidence: "High" },
        { signal: "Auth Pattern", finding: "Custom OAuth 2.0 + API keys + Okta SSO", evidence: "auth.nfl.com analysis", confidence: "High" },
        { signal: "Backend Tech", finding: "Java 40%, Node.js 35%, Python 15%, Go 10%", evidence: "GitHub repo analysis", confidence: "High" },
        { signal: "API Gateway", finding: "Apigee (Google)", evidence: "api.nfl.com headers", confidence: "High" },
        { signal: "CI/CD", finding: "GitHub Actions + custom tooling", evidence: "Workflow analysis", confidence: "High" },
      ]),
      maturityLevel: 2,
      maturityJustification: "Level 2 — Managed. Significant API infra (45 public, 200+ internal) but fragmented testing (6% Newman), inconsistent docs (6/10), slow partner onboarding (6-8 weeks).",
      confidenceJson: JSON.stringify({ overall: 85, sections: { infrastructure: 92, auth: 88, testing: 70, organization: 80, compliance: 90 } }),
      hypothesis: "NFL's 'API First' mandate + $20B revenue creates urgency. 6% Newman adoption reveals developer enablement gap. 300+ partner ecosystem = force multiplier. Partner onboarding (6-8 → 2 weeks) has direct revenue impact.",
      recommendedApproach: "Partner-first: Stats API pilot → partner onboarding acceleration → GameDay operations → enterprise rollout.",
      conversationAngle: "Lead with partner revenue angle — 300+ partners, 200+ support tickets/month, 6-8 week onboarding. Position Postman as partner enablement platform.",
      stakeholderTargetsJson: JSON.stringify([
        { role: "Brian Rolapp — CTO", why: "API First mandate sponsor", firstMeetingGoal: "Validate partner onboarding as priority" },
        { role: "Jason Rivera — Director of API Platform", why: "Champion, uses Postman personally", firstMeetingGoal: "Agree on Stats API pilot scope" },
        { role: "Tom Park — Head of Partner Integrations", why: "Owns 300+ partner relationships", firstMeetingGoal: "Map onboarding flow" },
        { role: "David Kim — CISO", why: "Security gate, SOC 2 audit", firstMeetingGoal: "Address compliance upfront" },
      ]),
      firstMeetingAgendaJson: JSON.stringify([
        { timeBlock: "5 min", topic: "Validate API First priorities", detail: "Confirm partner onboarding speed is top pain." },
        { timeBlock: "10 min", topic: "Partner onboarding walkthrough", detail: "Map the 6-8 week flow." },
        { timeBlock: "10 min", topic: "Stats API pilot proposal", detail: "Collection + mock + contract tests for partners." },
        { timeBlock: "5 min", topic: "Security alignment", detail: "SOC 2, SSO, secrets management." },
      ]),
      generatedBriefMarkdown: "# Discovery Brief: NFL\n\n## Company Snapshot\n- Industry: Sports & Entertainment\n- Engineering: 600+ engineers\n- API Presence: 45 public APIs, 300+ partners\n\n## Maturity: Level 2\n6% Newman adoption. Inconsistent docs. Slow partner onboarding.\n\n## Hypothesis\nPartner onboarding acceleration (6-8 weeks → 2 weeks) has direct revenue impact for $20B league.",
      generatedBriefJson: JSON.stringify({ projectName: "NFL" }),
      aiGenerated: false,
    },
  });

  console.log(`✓ NFL project created (${nflProject.id}) for Daniel: ${nflStats.docCount} docs, ${nflStats.chunkCount} chunks`);

  // =========================================================================
  // 7-ELEVEN PROJECT FOR HAMMAD (optional — skipped if Hammad doesn't exist)
  // =========================================================================

  if (!hammad) {
    console.log("⏭ Skipping 7-Eleven project (Hammad user not found)");
    console.log("\nDone! NFL project seeded.");
    return;
  }

  const existing711 = await prisma.project.findFirst({
    where: { name: { contains: "7-Eleven", mode: "insensitive" }, ownerUserId: hammad.id },
  });
  if (existing711) {
    await prisma.project.delete({ where: { id: existing711.id } });
    console.log(`  Deleted existing 7-Eleven project: ${existing711.id}`);
  }

  const project711 = await prisma.project.create({
    data: {
      name: "7-Eleven",
      primaryDomain: "7-eleven.com",
      apiDomain: "api.7-eleven.com",
      customerContactName: "Raghu Mahadevan (SVP & CTO)",
      customerContactEmail: "raghu.mahadevan@7-eleven.com",
      ownerUserId: hammad.id,
      isPinned: true,
      engagementStage: 2,
    },
  });

  const docs711 = [
    { source: "KEPLER", title: "7-Eleven Kepler account overview", rawText: "7-Eleven Inc — World's largest convenience store chain. 13,000+ stores in US/Canada, 83,000+ globally across 19 countries. $100B+ global system sales. Headquartered in Dallas, TX. Owned by Seven & i Holdings (Japan). Massive digital transformation: 7NOW delivery app, 7Rewards loyalty (75M+ members), Speedway integration (3,800 locations acquired 2021). CTO Raghu Mahadevan driving 'One Platform' vision. ~400 engineers across Dallas HQ, digital products, and franchise technology." },
    { source: "KEPLER", title: "7-Eleven technology stack and platform notes", rawText: "Primary cloud: GCP (Firebase integration, GKE for backend). Secondary: AWS for legacy migration. Mobile: React Native. BFF: Node.js. Loyalty: Java Spring Boot on GKE. Payments: custom gateway (Stripe, Worldpay). Edge computing at 13,000 stores. CDN: Cloudflare. DB: Cloud SQL, Firestore, BigQuery. Messaging: Pub/Sub. API Gateway: Apigee. 300+ microservices across store ops, loyalty, delivery, payments, and franchise systems." },
    { source: "KEPLER", title: "7-Eleven API platform and integration needs", rawText: "Building unified commerce API platform. 13,000 store POS systems, 7NOW delivery fleet, 7Rewards loyalty engine, franchise management, 50+ delivery partners (DoorDash, Uber Eats, Grubhub, Instacart). Each partner integration custom-built, takes 3-4 months. Store inventory API: real-time sync, <2s latency across 13K locations. Payment APIs: $100M+ daily. CTO wants to consolidate 8 API gateways into unified Apigee with standardized docs, testing, and partner onboarding." },
    { source: "KEPLER", title: "7-Eleven developer experience and tooling", rawText: "Internal devhub.7-eleven.com (not public). 300+ internal APIs, 15+ partner-facing. Documentation quality varies wildly. Newman: 0% adoption. Testing: JUnit/Jest only, no API integration tests. Partner testing via manual curl scripts in Google Docs. No mock servers. No contract testing. Partner API response: 120ms avg. Inconsistent versioning." },
    { source: "KEPLER", title: "7-Eleven engineering org and key contacts", rawText: "CTO: Raghu Mahadevan. VP Engineering Digital: Priya Sharma. Director API Platform: Mike Chen (ex-Stripe, hired 3 months ago). Head Store Tech: Robert Kim. Head Delivery/Logistics: Amanda Torres. CISO: James Wilson. 400 engineers total. Platform: 30. Store tech: 80. Mobile/digital: 60. Delivery: 45. Loyalty: 35. Payments: 25. QA: 30. Infra/SRE: 40. Key: 'One Platform' initiative by end FY2026." },
    { source: "KEPLER", title: "7-Eleven compliance and security", rawText: "PCI-DSS Level 1 ($100M+ daily payments). SOC 2 Type II. CCPA/GDPR for 7Rewards 75M members. FDA compliance for 7NOW delivery. Franchise data isolation. Data residency per country (19 countries). Speedway backward-compat during 2-year migration. All partner APIs require mTLS. Auth: OAuth 2.0 PKCE (mobile), client credentials (server), API key + HMAC (legacy POS)." },
    { source: "DNS", title: "7-eleven.com DNS analysis", rawText: "Cloudflare CDN. api.7-eleven.com CNAME -> Apigee. Google Workspace MX. Internal devhub.7-eleven.com. TLS 1.3, HSTS. Subdomains: api, m, loyalty, delivery, franchise, pos. DigiCert certificate." },
    { source: "DNS", title: "api.7-eleven.com endpoint analysis", rawText: "Apigee gateway. Rate limiting. OAuth 2.0 at auth.7-eleven.com. URL path versioning (/v2/). X-Request-ID, X-Correlation-ID headers. 80ms cached, 250ms uncached. Separate subdomains: delivery.api, loyalty.api, payments.api." },
    { source: "MANUAL", title: "Meeting notes: Initial discovery with 7-Eleven", rawText: "Met Mike Chen (API Platform Director, ex-Stripe) and Priya Sharma (VP Eng). Mike hired to build unified API platform, 3 months in, evaluating tools. Biggest pain: 50+ delivery partner integrations each custom, 3-4 months each (target: 2 weeks). Store inventory API most critical (13K stores, <2s). Legacy Speedway APIs need backward-compat wrapper. Mike used Postman at Stripe — strong champion. Budget approved FY2026." },
    { source: "MANUAL", title: "Meeting notes: Franchise technology", rawText: "Robert Kim: 5 POS systems (NCR, Oracle MICROS, Verifone, custom x2). 1,200+ franchisees. Edge computing per store syncs to GCP. Inventory: RFID + POS → Pub/Sub → service. Latency: <2s inventory, <500ms payments. Manual testing quarterly per POS update. Wants automated regression for every update." },
    { source: "MANUAL", title: "7-Eleven delivery partner analysis", rawText: "Current: Legal (4-6 weeks) → Custom adapter (4-6 weeks) → Staging test (2-3 weeks) → Certification (1-2 weeks) = 3-4 months. With Postman: Collection + mock (Day 1) → Partner develops against mock + contract tests (1 week) → Integration testing (3-5 days) → Auto certification (1 day) = 2 weeks. Saves ~$2M/year." },
    { source: "GITHUB", title: "7-Eleven api-gateway-configs repo", rawText: "8 Apigee proxy configs. Jenkins CI (migrating to GH Actions). 35 proxy bundles. 42% test coverage. No Newman/Postman tests. Manual curl scripts in /tests/manual/." },
    { source: "GITHUB", title: "7-Eleven delivery-service repo", rawText: "Node.js delivery orchestration. 12 partner adapters, each 400-800 lines custom code. Shared test fixtures for 3/12. Jest 65% coverage. No integration tests. OpenAPI spec 6 months stale. README: 'Use Postman or curl to test locally.' No collection provided." },
  ];

  const stats711 = await createChunksForProject(project711.id, docs711);

  await prisma.discoveryArtifact.create({
    data: {
      projectId: project711.id,
      version: 1,
      keplerPaste: "7-Eleven Inc — World's largest convenience store chain. 13K US stores, 83K globally, $100B+ system sales. 7NOW delivery, 7Rewards loyalty (75M members), Speedway integration. CTO Raghu Mahadevan 'One Platform' vision. ~400 engineers. 300+ microservices. 50+ delivery partners, each taking 3-4 months to integrate (target: 2 weeks). 8 API gateways → unified Apigee. Mike Chen (ex-Stripe) champion.",
      dnsFindings: "Cloudflare CDN. Apigee gateway. Internal-only developer hub. TLS 1.3, HSTS. Subdomains: api, m, loyalty, delivery, franchise, pos.",
      headerFindings: "Apigee headers. Rate limiting. Distributed tracing (X-Request-ID, X-Correlation-ID). URL path versioning (/v2/). 80ms cached, 250ms uncached.",
      publicFootprint: "No public developer portal. 15+ partner APIs, 300+ internal. 7Rewards 75M members. 7NOW in 2,000+ cities. Partial public API presence.",
      authForensics: "OAuth 2.0 PKCE (mobile), client credentials (server), API key + HMAC (POS). mTLS for partners. auth.7-eleven.com. Key rotation policies.",
      cloudGatewaySignals: "GCP (GKE, Cloud SQL, Firestore, BigQuery, Pub/Sub). AWS legacy migration. Cloudflare. Apigee. React Native. Edge computing at 13K stores. $100M daily payments.",
      developerFrictionSignals: "0% Newman. No Postman collections anywhere. JUnit/Jest only. Manual curl scripts in Google Docs. Documentation wildly inconsistent. No mock servers. No contract testing. 3-4 month partner onboarding. QA does quarterly manual store API testing.",
      evidenceLinksJson: JSON.stringify([{ label: "7NOW", url: "https://www.7-eleven.com/7now" }, { label: "7Rewards", url: "https://www.7-eleven.com/7rewards" }]),
      industry: "Retail / Convenience / Quick Service",
      engineeringSize: "~400 engineers across Dallas HQ, digital, and franchise tech",
      publicApiPresence: "Partial",
      technicalLandscapeJson: JSON.stringify([
        { signal: "Primary Cloud", finding: "GCP (GKE, Cloud SQL, Firestore, BigQuery)", evidence: "Firebase, DNS, Kepler", confidence: "High" },
        { signal: "CDN / Edge", finding: "Cloudflare + edge computing at 13K stores", evidence: "DNS, architecture notes", confidence: "High" },
        { signal: "Auth Pattern", finding: "OAuth 2.0 PKCE + API key/HMAC + mTLS", evidence: "Endpoint analysis", confidence: "High" },
        { signal: "Backend Tech", finding: "Java Spring Boot, Node.js, React Native", evidence: "GitHub repos, Kepler", confidence: "High" },
        { signal: "API Gateway", finding: "Apigee — consolidating 8 into one", evidence: "DNS, headers", confidence: "High" },
        { signal: "CI/CD", finding: "Jenkins → GitHub Actions migration", evidence: "Repo analysis", confidence: "Med" },
        { signal: "Messaging", finding: "GCP Pub/Sub for store event sync", evidence: "Architecture notes", confidence: "High" },
        { signal: "Edge Computing", finding: "Custom nodes at each of 13K stores", evidence: "Franchise tech discussion", confidence: "High" },
      ]),
      maturityLevel: 1,
      maturityJustification: "Level 1 — Initial. 300+ microservices but zero Newman, no contract testing, no mocks, manual curl scripts, wildly inconsistent docs. Scale (13K stores, 50+ partners, $100M daily) makes the gap an operational risk.",
      confidenceJson: JSON.stringify({ overall: 80, sections: { infrastructure: 88, auth: 82, testing: 60, organization: 75, compliance: 85 } }),
      hypothesis: "'One Platform' CTO vision + zero API testing = high-urgency opportunity. Delivery partner onboarding (3-4 months → 2 weeks) saves ~$2M/year. Store API testing automation critical for 13K locations. Champion (Mike Chen, ex-Stripe) knows Postman.",
      recommendedApproach: "Delivery partner acceleration first (DoorDash/Uber Eats pilot) → store inventory API testing → enterprise rollout.",
      conversationAngle: "Lead with delivery partner pain — 3-4 months × 50+ partners is unsustainable. $2M/year savings. Position Postman as the missing layer for Apigee consolidation.",
      stakeholderTargetsJson: JSON.stringify([
        { role: "Raghu Mahadevan — CTO", why: "'One Platform' sponsor, FY2026 budget", firstMeetingGoal: "Validate priorities" },
        { role: "Mike Chen — Director API Platform", why: "Champion, ex-Stripe, knows Postman", firstMeetingGoal: "Agree on pilot scope" },
        { role: "Priya Sharma — VP Engineering Digital", why: "Owns mobile/digital, wants velocity metrics", firstMeetingGoal: "Map developer workflow" },
        { role: "Robert Kim — Head of Store Tech", why: "13K store edge systems, 5 POS integrations", firstMeetingGoal: "Propose automated regression testing" },
        { role: "Amanda Torres — Head of Delivery/Logistics", why: "Owns 50+ partner integrations", firstMeetingGoal: "Walk through onboarding flow" },
      ]),
      firstMeetingAgendaJson: JSON.stringify([
        { timeBlock: "5 min", topic: "Validate 'One Platform' priorities", detail: "Confirm partner onboarding + API testing are top pain points." },
        { timeBlock: "10 min", topic: "Delivery partner deep-dive", detail: "Map the 3-4 month flow. Identify compression opportunities." },
        { timeBlock: "10 min", topic: "Store API testing discussion", detail: "Quarterly manual cycle → automated regression testing proposal." },
        { timeBlock: "5 min", topic: "Security & compliance", detail: "PCI-DSS, mTLS, franchise isolation. Schedule CISO follow-up." },
      ]),
      generatedBriefMarkdown: "# Discovery Brief: 7-Eleven\n\n## Company Snapshot\n- Industry: Retail / Convenience\n- Engineering: ~400 engineers\n- Scale: 13K US stores, 83K global, $100B+ sales\n\n## Maturity: Level 1\n0% Newman. Manual curl scripts. Inconsistent docs.\n\n## Hypothesis\nDelivery partner acceleration (3-4 months → 2 weeks) saves $2M/year. Store API testing automation critical at 13K store scale.",
      generatedBriefJson: JSON.stringify({ projectName: "7-Eleven" }),
      aiGenerated: false,
    },
  });

  console.log(`✓ 7-Eleven project created (${project711.id}) for Hammad: ${stats711.docCount} docs, ${stats711.chunkCount} chunks`);

  console.log("\nDone! Both projects seeded with full Kepler discovery data.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
