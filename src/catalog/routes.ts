import { Router } from 'express';
import type { Request, Response } from 'express';
import { isCountryCode } from '../aggregators/routes';
import { getCatalog } from './build';

const DEFAULT_COUNTRY = 'CH';

/** `GET /api/catalog?country=CH` — every category, every institution we know how to connect. */
export function createCatalogRouter(): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    const raw = req.query.country ?? DEFAULT_COUNTRY;
    if (!isCountryCode(raw)) {
      return res.status(400).json({ error: 'country must be an ISO alpha-2 code' });
    }
    try {
      res.json(await getCatalog(raw));
    } catch (err) {
      res.status(500).json({
        error: 'Could not build the catalogue',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return router;
}
