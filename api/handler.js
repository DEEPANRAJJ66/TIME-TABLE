import handler, {
  handleApiRequest,
  sendJson,
  getApplicationOrigin,
  parseJsonBody,
  parseRawBody,
  decodeJwtPayload,
  resolveActor,
  safeDecodeURIComponent
} from '../lib/handler.js';

export {
  handleApiRequest,
  sendJson,
  getApplicationOrigin,
  parseJsonBody,
  parseRawBody,
  decodeJwtPayload,
  resolveActor,
  safeDecodeURIComponent
};

export default handler;
