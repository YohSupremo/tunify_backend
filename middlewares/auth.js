const jwt = require("jsonwebtoken");

exports.isAuthenticatedUser = (req, res, next) => {
    if (!req.header('Authorization')) {
        return res.status(401).json({ message: 'Login first to access this resource' });
    }

    const token = req.header('Authorization').split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Login first to access this resource' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.body = req.body || {};
        req.body.user = { id: decoded.id };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid token, login again' });
    }
};
