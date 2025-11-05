module.exports = (err, _req, res, _next) => {
    const status = err.status || 500;
    const message = err.publicMessage || err.message || 'Server Error';
    res.status(status).json({ message, data: null })
}
