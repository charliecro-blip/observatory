import { Router, type IRouter } from "express";
// Nine routers left here on 2026-08-16 with the legacy health-tracker app:
// activities, blueprint, bodyWeather, calendar, insights, knowledge, openai,
// supplements, supportPreferences. Measured first — zero Compass consumers,
// zero daemon consumers, and the only client that ever called them was the
// health-tracker app deleted in the same commit. Their DATA tables stay in
// the schema untouched, same rule as the cultivations deletion.
import healthRouter from "./health";
import logsRouter from "./logs";
import natalRouter from "./natal";
import checkInsRouter from "./checkIns";
import astroDebugRouter from "./astroDebug";
import locationSearchRouter from "./locationSearch";
import tidesRouter from "./tides";
import planningRouter from "./planning";
import tasksRouter from "./tasks";
import habitsRouter from "./habits";
import pushRouter from "./push";
import googleCalRouter from "./googleCal";
import adviseRouter from "./advise";
import billingRouter from "./billing";
import calendarAuditRouter from "./calendarAudit";
import diaryRouter from "./diary";
import daemonMemoryRouter from "./daemonMemory";
import cycleRouter from "./cycle";
import exportIcalRouter from "./exportIcal";
import currentsRouter from "./currents";
import electionRouter from "./election";
import accountRouter from "./account";
import associateRouter from "./associate";
import planRouter from "./plan";
import reportsRouter from "./reports";
import skyLiteracyRouter from "./skyLiteracy";
import chartRouter from "./chart";
import studioRouter from "./studio";
import momentumRouter from "./momentum";
import sprintsRouter from "./sprints";
import electionsRouter from "./elections";
import eventsRouter from "./events";
import donePatternRouter from "./donePattern";
import engineRouter from "./engine";
import positionFixRouter from "./positionFix";

const router: IRouter = Router();

router.use(healthRouter);
router.use(logsRouter);
router.use(natalRouter);
router.use(checkInsRouter);
router.use(astroDebugRouter);
router.use(locationSearchRouter);
router.use(tidesRouter);
router.use(planningRouter);
router.use(tasksRouter);
router.use(habitsRouter);
// `icalRouter` (routes/ical.ts) is deliberately GONE, not just unimported.
// It accepted the tester id from `?tid=` — the exact account-credential-in-URL
// pattern the feed-token withdrawal of 2026-07-30 closed — and this barrel
// kept it mounted after that withdrawal, invisibly: nothing in the client
// linked to it, so it only ever served whoever knew to ask. /export/ical with
// a feed token is the one calendar surface.
router.use(pushRouter);
router.use(googleCalRouter);
router.use(adviseRouter);
router.use(billingRouter);
router.use(calendarAuditRouter);
router.use(diaryRouter);
router.use(daemonMemoryRouter);
router.use(cycleRouter);
router.use(exportIcalRouter);
router.use(currentsRouter);
router.use(electionRouter);
router.use(accountRouter);
router.use(associateRouter);
router.use(planRouter);
router.use(reportsRouter);
router.use(skyLiteracyRouter);
router.use(chartRouter);
router.use(studioRouter);
router.use(momentumRouter);
router.use(sprintsRouter);
router.use(electionsRouter);
router.use(eventsRouter);
router.use(donePatternRouter);
router.use(engineRouter);
router.use(positionFixRouter);

export default router;
