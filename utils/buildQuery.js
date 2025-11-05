function parseJSON(q, field) {
    if (q == undefined) return undefined;
    try { return JSON.parse(q); }
    catch {
        err = new Error(`Invalid JSON for '${field}'`);
        err.status = 400;
        throw err;
    }
}

function buildQueryParams(req, { defaultLimit }) {
    const where = parseJSON(req.query.where, 'where') || {};
    const sort = parseJSON(req.query.sort, 'sort') || undefined;
    const select = parseJSON(req.query.select, 'select') || undefined;
    const skip = req.query.skip ? Number(req.query.skip) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : defaultLimit;
    const count = String(req.query.count).toLowerCase() === 'true';
    return { where, sort, select, skip, limit, count };
}

module.exports = { buildQueryParams };
