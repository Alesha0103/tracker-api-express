const { Schema, model } = require("mongoose");

const ProjectSchema = new Schema({
    name: { type: String, required: true },
    createdAt: { type: String, default: Date.now },
    updatedAt: { type: String, default: Date.now },
    trackedHours: { type: String, default: 0 },
});

const UserSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    isActivated: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    activationLink: { type: String },
    projects: { type: [ProjectSchema], required: false },
});

module.exports = model("User", UserSchema);
