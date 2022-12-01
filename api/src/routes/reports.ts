import express, { NextFunction, Response, Request } from "express";
import { FhirApi } from "../lib/utils";
import { requireJWTMiddleware as requireJWT, decodeSession } from "../lib/jwt";
import { generateANCSummary, generateMOH405Report, generateMOH711Report } from "../lib/reports";
import db from '../lib/prisma';
const router = express.Router()

router.use(express.json())

router.use(function (err: any, req: Request, res: Response, next: NextFunction) {
    console.error('Got an error!', err);
    res.end();
});

router.get('/moh-405', [requireJWT], async (req: Request, res: Response) => {
    try {
        res.statusCode = 200;
        let token = req.headers.authorization || null;
        if (!token) {
            res.statusCode = 401;
            res.json({ error: "Invalid access token", status: "error" });
            return;
        }
        let decodedSession = decodeSession(process.env['SECRET_KEY'] as string, token.split(' ')[1]);
        if (decodedSession.type == 'valid') {
            let userId = decodedSession.session.userId
            let user = await db.user.findFirst({
                where: {
                    id: userId
                }
            });

            let report = [];
            let { from, to } = req.params;
            let patientIds: any = [];
            let patients = await (await FhirApi({ url: `/Patient${user?.facilityKmhflCode && `?identifier=${user?.facilityKmhflCode}`}` })).data?.entry || [];
            patients.map((patient: any) => {
                patientIds.push(patient.resource.id);
            })
            let today = new Date(new Date(new Date().setHours(0)).setMinutes(0)).setSeconds(0).toLocaleString()
            for (let id of patientIds) {
                report.push(await generateMOH405Report(id, from || null, to || null));
            }
            res.json({ report, status: "success" });
            return
        }
        res.statusCode = 401;
        res.json({ error: "Invalid access token", status: "error" });
        return;
    } catch (error) {
        console.error(error)
        res.statusCode = 400
        res.json({ error, status: "error" })
        return
    }
})

router.get('/moh-711', async (req: Request, res: Response) => {
    try {
        res.statusCode = 200;
        let report = (await generateMOH711Report());
        res.json({ report, status: "success" });
        return
    } catch (error) {
        console.error(error);
        res.statusCode = 400;
        res.json({ error, status: "error" });
        return
    }
});

router.get('/anc-summary', async (req: Request, res: Response) => {

    try {
        res.statusCode = 200;
        let report = (await generateANCSummary());
        res.json({ report, status: "success" });
        return;
    } catch (error) {
        console.error(error);
        res.statusCode = 400;
        res.json({ error, status: "error" });
        return;
    }
})


export default router