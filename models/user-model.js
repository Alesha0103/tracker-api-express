const { Schema, model } = require("mongoose");

const Stats = new Schema(
    {
        date: { type: String },
        hours: { type: Number },
    },
    { _id: false }
);

const ProjectSchema = new Schema({
    name: { type: String, required: true },
    createdAt: { type: String, default: Date.now },
    updatedAt: { type: String, default: Date.now },
    hours: { type: Number, default: 0 },
    stats: { type: [Stats], require: true },
    isDisabled: { type: Boolean, required: true },
});

const UserSchema = new Schema({
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    isActivated: { type: Boolean, default: false },
    isAdmin: { type: Boolean, default: false },
    activationLink: { type: String },
    totalHours: { type: Number, default: 0 },
    projects: { type: [ProjectSchema], required: false },
});

module.exports = model("User", UserSchema);
