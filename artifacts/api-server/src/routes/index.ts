import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assetsRouter from "./assets";
import usersRouter from "./users";
import auditRouter from "./audit";
import reportsRouter from "./reports";
import custodyRouter from "./custody";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(auditRouter);
router.use(reportsRouter);
router.use(custodyRouter);
router.use(assetsRouter);

export default router;
