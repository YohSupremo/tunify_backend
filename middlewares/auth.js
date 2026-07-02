const jwt  = require("jsonwebtoken");
const db   = require("../models");
const User = db.User;

exports.isAuthenticatedUser = async (req, res, next) => {
    if (!req.header('Authorization')) {
        return res.status(401).json({ message: 'Login first to access this resource' });
    }

    const token = req.header('Authorization').split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Login first to access this resource' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // DB check on every request — if account was deactivated after the token
        // was issued, the token is still cryptographically valid but we block it here.
        const user = await User.findOne({ where: { id: decoded.id } });
        if (!user) {
            return res.status(401).json({ message: 'Account not found. Please log in again.' });
        }
        if (user.token !== token) {
            return res.status(401).json({ message: 'Session expired or logged out. Please log in again.' });
        }
        if (user.deleted_at !== null) {
            return res.status(401).json({ message: 'Your account has been deactivated. Please contact support.' });
        }

        req.user = { id: decoded.id, role: user.role };
        req.body = req.body || {};
        req.body.user = req.user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token, login again' });
    }
};

exports.isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ error: "Access denied. Admins only." });
    }
};
