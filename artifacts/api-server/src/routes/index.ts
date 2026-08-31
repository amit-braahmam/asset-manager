import { Router, type IRouter } from "express";
import healthRouter from "./health";
import assetsRouter from "./assets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(assetsRouter);

export default router;
