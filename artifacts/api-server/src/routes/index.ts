import { Router, type IRouter } from "express";
import healthRouter from "./health";
import supplementsRouter from "./supplements";
import activitiesRouter from "./activities";
import logsRouter from "./logs";
import insightsRouter from "./insights";
import openaiRouter from "./openai";
import natalRouter from "./natal";
import checkInsRouter from "./checkIns";
import bodyWeatherRouter from "./bodyWeather";
import astroDebugRouter from "./astroDebug";
import locationSearchRouter from "./locationSearch";
import blueprintRouter from "./blueprint";
import supportPreferencesRouter from "./supportPreferences";
import knowledgeRouter from "./knowledge";
import calendarRouter from "./calendar";
import tidesRouter from "./tides";
import planningRouter from "./planning";
import tasksRouter from "./tasks";
import habitsRouter from "./habits";
import pushRouter from "./push";
import googleCalRouter from "./googleCal";
import adviseRouter from "./advise";
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
import electionsRouter from "./elections";
import eventsRouter from "./events";
import donePatternRouter from "./donePattern";
import engineRouter from "./engine";
import positionFixRouter from "./positionFix";

const router: IRouter = Router();

router.use(healthRouter);
router.use(supplementsRouter);
router.use(activitiesRouter);
router.use(logsRouter);
router.use(insightsRouter);
router.use(openaiRouter);
router.use(natalRouter);
router.use(checkInsRouter);
router.use(bodyWeatherRouter);
router.use(astroDebugRouter);
router.use(locationSearchRouter);
router.use(blueprintRouter);
router.use(supportPreferencesRouter);
router.use(knowledgeRouter);
router.use(calendarRouter);
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
router.use(electionsRouter);
router.use(eventsRouter);
router.use(donePatternRouter);
router.use(engineRouter);
router.use(positionFixRouter);

export default router;
