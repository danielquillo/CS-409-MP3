// Load required packages
var mongoose = require('mongoose');

// Define our user schema
var UserSchema = new mongoose.Schema(
    {
    name: { type: String, required: [true, 'name is required'] },
    email: {
        type: String,
        required: [true, 'email is required'],
        lowercase: true,
        trim: true,
        unique: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'email is invalid'],
    },
    pendingTasks: { type: [String], default: [] }, // task _ids as strings
    dateCreated: { type: Date, default: Date.now, immutable: true },
    },
    { versionKey: false }
);

// Export the Mongoose model
module.exports = mongoose.model('User', UserSchema);
