require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const session = require("express-session");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
session({
secret: process.env.SESSION_SECRET || "freefire-admin-secret",
resave: false,
saveUninitialized: false,
cookie: {
httpOnly: true,
sameSite: "lax",
secure: false
}
})
);

// ==========================================
// STATIC FILES
// ==========================================

app.use(
"/images",
express.static(path.join(__dirname, "public", "images"))
);

// ==========================================
// MONGODB
// ==========================================

const MONGODB_URI = process.env.MONGODB_URI;

let mongoConnected = false;

if (!MONGODB_URI) {

console.log("❌ MONGODB_URI is missing in .env file");

} else {

mongoose
    .connect(MONGODB_URI)
    .then(() => {

        mongoConnected = true;

        console.log("✅ MongoDB connected successfully");

    })
    .catch((error) => {

        mongoConnected = false;

        console.log("❌ MongoDB connection error:");
        console.log(error.message);

    });

mongoose.connection.on("connected", () => {

    mongoConnected = true;

    console.log("🟢 MongoDB connection active");

});

mongoose.connection.on("disconnected", () => {

    mongoConnected = false;

    console.log("🟠 MongoDB disconnected");

});

mongoose.connection.on("error", (error) => {

    console.log("❌ MongoDB error:");
    console.log(error.message);

});

}

// ==========================================
// DATABASE CHECK
// ==========================================

function isDatabaseConnected() {

return mongoose.connection.readyState === 1;

}

// ==========================================
// TOURNAMENT MODEL
// ==========================================

const tournamentSchema = new mongoose.Schema(
{
name: {
type: String,
required: true,
trim: true
},

    date: {
        type: String,
        required: true
    },

    time: {
        type: String,
        required: true
    },

    entryFee: {
        type: Number,
        default: 10
    },

    maxSlots: {
        type: Number,
        default: 48,
        min: 1
    },

    registeredPlayers: {
        type: Number,
        default: 0,
        min: 0
    },

    roomId: {
        type: String,
        default: ""
    },

    roomPassword: {
        type: String,
        default: ""
    },

    registrationStatus: {
        type: String,
        enum: ["OPEN", "CLOSED"],
        default: "OPEN"
    }
},
{
    timestamps: true
}

);

const Tournament = mongoose.model(
"Tournament",
tournamentSchema
);

// ==========================================
// PLAYER MODEL
// ==========================================

const playerSchema = new mongoose.Schema(
{
tournamentId: {
type: mongoose.Schema.Types.ObjectId,
ref: "Tournament",
required: true
},

    playerName: {
        type: String,
        required: true,
        trim: true
    },

    freeFireUID: {
        type: String,
        required: true,
        trim: true
    },

    nickname: {
        type: String,
        required: true,
        trim: true
    },

    mobile: {
        type: String,
        required: true,
        trim: true
    },

    utr: {
        type: String,
        required: true,
        trim: true
    },

    paymentStatus: {
        type: String,
        enum: ["PENDING", "VERIFIED", "REJECTED"],
        default: "PENDING"
    },

    slotNumber: {
        type: Number,
        default: null
    },

    accessToken: {
        type: String,
        default: null,
        select: false
    }
},
{
    timestamps: true
}

);

const Player = mongoose.model(
"Player",
playerSchema
);

// ==========================================
// ADMIN LOGIN
// ==========================================

const ADMIN_USERNAME = "SHIVANSHU@FF";
const ADMIN_PASSWORD = "252890204327";

// ==========================================
// ADMIN LOGIN PAGE
// ==========================================

app.get("/admin/login", (req, res) => {

res.sendFile(
    path.join(
        __dirname,
        "admin",
        "admin-login.html"
    )
);

});

// ==========================================
// ADMIN LOGIN
// ==========================================

app.post("/admin/login", (req, res) => {

const {
    username,
    password
} = req.body;

if (
    username === ADMIN_USERNAME &&
    password === ADMIN_PASSWORD
) {

    req.session.isAdmin = true;

    return res.json({
        success: true
    });

}

return res.status(401).json({

    success: false,

    message:
        "Invalid username or password"

});

});

// ==========================================
// ADMIN LOGOUT
// ==========================================

app.get("/admin/logout", (req, res) => {

req.session.destroy(() => {

    res.redirect("/admin/login");

});

});

// ==========================================
// ADMIN AUTH
// ==========================================

function requireAdmin(req, res, next) {

if (!req.session.isAdmin) {

    return res.status(401).json({

        success: false,

        message:
            "Admin login required"

    });

}

next();

}

// ==========================================
// ADMIN HTML
// ==========================================

app.get("/admin/admin.html", (req, res) => {

if (!req.session.isAdmin) {

    return res.redirect("/admin/login");

}

res.sendFile(
    path.join(
        __dirname,
        "admin",
        "admin.html"
    )
);

});

// ==========================================
// ROOT PLAYER PAGE
// ==========================================

app.get("/", (req, res) => {

res.sendFile(
    path.join(
        __dirname,
        "public",
        "index.html"
    )
);

});

// ==========================================
// CREATE TOURNAMENT
// ==========================================

app.post(
"/api/tournaments",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const {
            tournamentName,
            date,
            time,
            entryFee,
            maxSlots,
            roomId,
            roomPassword,
            registrationStatus
        } = req.body;

        if (
            !tournamentName ||
            !date ||
            !time
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Tournament name, date and time are required"

            });

        }

        const finalMaxSlots =
            Number(maxSlots) > 0
                ? Number(maxSlots)
                : 48;

        const finalEntryFee =
            Number(entryFee) >= 0
                ? Number(entryFee)
                : 10;

        const finalStatus =
            registrationStatus === "CLOSED"
                ? "CLOSED"
                : "OPEN";

        const tournament =
            await Tournament.create({

                name:
                    tournamentName.trim(),

                date:
                    date,

                time:
                    time,

                entryFee:
                    finalEntryFee,

                maxSlots:
                    finalMaxSlots,

                roomId:
                    roomId || "",

                roomPassword:
                    roomPassword || "",

                registrationStatus:
                    finalStatus,

                registeredPlayers:
                    0

            });

        console.log(
            "🏆 New tournament created:",
            tournament.name
        );

        return res.json({

            success: true,

            tournament

        });

    } catch (error) {

        console.log(
            "❌ Create tournament error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to create tournament"

        });

    }

}

);

// ==========================================
// GET LATEST TOURNAMENT
// PUBLIC
// ==========================================

app.get(
"/api/tournaments/latest",
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const tournament =
            await Tournament
                .findOne({})
                .sort({
                    createdAt: -1
                })
                .lean();

        if (!tournament) {

            return res.status(404).json({

                success: false,

                message:
                    "No tournament found"

            });

        }

        const availableSlots =
            Math.max(
                tournament.maxSlots -
                tournament.registeredPlayers,
                0
            );

        return res.json({

            success: true,

            name:
                tournament.name,

            tournamentName:
                tournament.name,

            date:
                tournament.date,

            time:
                tournament.time,

            entryFee:
                tournament.entryFee,

            maxSlots:
                tournament.maxSlots,

            registeredPlayers:
                tournament.registeredPlayers,

            availableSlots:
                availableSlots,

            registrationStatus:
                tournament.registrationStatus,

            roomId:
                tournament.roomId,

            roomPassword:
                tournament.roomPassword,

            tournamentId:
                tournament._id

        });

    } catch (error) {

        console.log(
            "❌ Latest tournament error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error while loading tournament",

            error:
                error.message

        });

    }

}

);

// ==========================================
// PLAYER REGISTRATION
// ==========================================

app.post(
"/api/players/register",
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const {
            playerName,
            freeFireUID,
            nickname,
            mobile,
            utr
        } = req.body;

        if (
            !playerName ||
            !freeFireUID ||
            !nickname ||
            !mobile ||
            !utr
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "All fields are required"

            });

        }

        const tournament =
            await Tournament
                .findOne()
                .sort({
                    createdAt: -1
                });

        if (!tournament) {

            return res.status(404).json({

                success: false,

                message:
                    "No tournament available"

            });

        }

        if (
            tournament.registrationStatus !==
            "OPEN"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Registration is closed"

            });

        }

        if (
            tournament.registeredPlayers >=
            tournament.maxSlots
        ) {

            tournament.registrationStatus =
                "CLOSED";

            await tournament.save();

            return res.status(400).json({

                success: false,

                message:
                    "All slots are full"

            });

        }

        const duplicateUID =
            await Player.findOne({

                tournamentId:
                    tournament._id,

                freeFireUID:
                    freeFireUID

            });

        if (duplicateUID) {

            return res.status(400).json({

                success: false,

                message:
                    "This Free Fire UID is already registered"

            });

        }

        const duplicateMobile =
            await Player.findOne({

                tournamentId:
                    tournament._id,

                mobile:
                    mobile

            });

        if (duplicateMobile) {

            return res.status(400).json({

                success: false,

                message:
                    "This mobile number is already registered"

            });

        }

        const duplicateUTR =
            await Player.findOne({

                tournamentId:
                    tournament._id,

                utr:
                    utr

            });

        if (duplicateUTR) {

            return res.status(400).json({

                success: false,

                message:
                    "This UTR / Transaction ID is already used"

            });

        }

        const accessToken =
            crypto
                .randomBytes(32)
                .toString("hex");

        const player =
            await Player.create({

                tournamentId:
                    tournament._id,

                playerName:
                    playerName.trim(),

                freeFireUID:
                    freeFireUID.trim(),

                nickname:
                    nickname.trim(),

                mobile:
                    mobile.trim(),

                utr:
                    utr.trim(),

                paymentStatus:
                    "PENDING",

                slotNumber:
                    null,

                accessToken:
                    accessToken

            });

        console.log(
            "👤 New player registered:",
            player.playerName
        );

        return res.json({

            success: true,

            message:
                "Registration submitted successfully",

            playerId:
                player._id,

            accessToken:
                accessToken

        });

    } catch (error) {

        console.log(
            "❌ Player registration error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to register player"

        });

    }

}

);

// ==========================================
// PLAYER PAYMENT STATUS / ACCESS
// ==========================================

app.get(
"/api/player/access/:accessToken",
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const token =
            req.params.accessToken;

        if (!token) {

            return res.status(400).json({

                success: false,

                message:
                    "Access token is required"

            });

        }

        const player =
            await Player
                .findOne({

                    accessToken:
                        token

                })
                .select("+accessToken")
                .lean();

        if (!player) {

            return res.status(404).json({

                success: false,

                message:
                    "Registration not found"

            });

        }

        if (
            player.paymentStatus ===
            "PENDING"
        ) {

            return res.json({

                success: true,

                status:
                    "PENDING",

                message:
                    "Payment is pending verification"

            });

        }

        if (
            player.paymentStatus ===
            "REJECTED"
        ) {

            return res.json({

                success: true,

                status:
                    "REJECTED",

                message:
                    "Payment was rejected"

            });

        }

        if (
            player.paymentStatus ===
            "VERIFIED"
        ) {

            const tournament =
                await Tournament
                    .findById(
                        player.tournamentId
                    )
                    .lean();

            if (!tournament) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Tournament not found"

                });

            }

            return res.json({

                success: true,

                status:
                    "VERIFIED",

                playerName:
                    player.playerName,

                nickname:
                    player.nickname,

                freeFireUID:
                    player.freeFireUID,

                slotNumber:
                    player.slotNumber,

                roomId:
                    tournament.roomId,

                roomPassword:
                    tournament.roomPassword,

                tournamentName:
                    tournament.name,

                tournamentDate:
                    tournament.date,

                tournamentTime:
                    tournament.time

            });

        }

        return res.status(400).json({

            success: false,

            message:
                "Unknown payment status"

        });

    } catch (error) {

        console.log(
            "❌ Player access error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to check payment status"

        });

    }

}

);

// ==========================================
// ADMIN — GET ALL TOURNAMENTS
// STEP 2
// ==========================================

app.get(
"/api/admin/tournaments",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const tournaments =
            await Tournament
                .find({})
                .sort({
                    createdAt: -1
                })
                .lean();

        const tournamentData =
            await Promise.all(

                tournaments.map(
                    async tournament => {

                        const [
                            totalPlayers,
                            verifiedPlayers,
                            pendingPlayers,
                            rejectedPlayers
                        ] =
                            await Promise.all([

                                Player.countDocuments({
                                    tournamentId:
                                        tournament._id
                                }),

                                Player.countDocuments({
                                    tournamentId:
                                        tournament._id,

                                    paymentStatus:
                                        "VERIFIED"
                                }),

                                Player.countDocuments({
                                    tournamentId:
                                        tournament._id,

                                    paymentStatus:
                                        "PENDING"
                                }),

                                Player.countDocuments({
                                    tournamentId:
                                        tournament._id,

                                    paymentStatus:
                                        "REJECTED"
                                })

                            ]);

                        return {

                            _id:
                                tournament._id,

                            name:
                                tournament.name,

                            date:
                                tournament.date,

                            time:
                                tournament.time,

                            entryFee:
                                tournament.entryFee,

                            maxSlots:
                                tournament.maxSlots,

                            registeredPlayers:
                                tournament.registeredPlayers,

                            registrationStatus:
                                tournament.registrationStatus,

                            roomId:
                                tournament.roomId,

                            roomPassword:
                                tournament.roomPassword,

                            totalPlayers:
                                totalPlayers,

                            verifiedPlayers:
                                verifiedPlayers,

                            pendingPlayers:
                                pendingPlayers,

                            rejectedPlayers:
                                rejectedPlayers,

                            availableSlots:
                                Math.max(
                                    tournament.maxSlots -
                                    verifiedPlayers,
                                    0
                                ),

                            createdAt:
                                tournament.createdAt

                        };

                    }
                )

            );

        return res.json({

            success: true,

            tournaments:
                tournamentData

        });

    } catch (error) {

        console.log(
            "❌ Get tournaments error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load tournaments"

        });

    }

}

);

// ==========================================
// ADMIN — GET SINGLE TOURNAMENT
// STEP 2
// ==========================================

app.get(
"/api/admin/tournaments/:tournamentId",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        if (
            !mongoose.Types.ObjectId.isValid(
                req.params.tournamentId
            )
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid tournament ID"

            });

        }

        const tournament =
            await Tournament
                .findById(
                    req.params.tournamentId
                )
                .lean();

        if (!tournament) {

            return res.status(404).json({

                success: false,

                message:
                    "Tournament not found"

            });

        }

        const [
            totalPlayers,
            verifiedPlayers,
            pendingPlayers,
            rejectedPlayers
        ] =
            await Promise.all([

                Player.countDocuments({
                    tournamentId:
                        tournament._id
                }),

                Player.countDocuments({
                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "VERIFIED"
                }),

                Player.countDocuments({
                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "PENDING"
                }),

                Player.countDocuments({
                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "REJECTED"
                })

            ]);

        return res.json({

            success: true,

            tournament: {

                id:
                    tournament._id,

                name:
                    tournament.name,

                date:
                    tournament.date,

                time:
                    tournament.time,

                entryFee:
                    tournament.entryFee,

                maxSlots:
                    tournament.maxSlots,

                registeredPlayers:
                    tournament.registeredPlayers,

                registrationStatus:
                    tournament.registrationStatus,

                roomId:
                    tournament.roomId,

                roomPassword:
                    tournament.roomPassword,

                totalPlayers:
                    totalPlayers,

                verifiedPlayers:
                    verifiedPlayers,

                pendingPlayers:
                    pendingPlayers,

                rejectedPlayers:
                    rejectedPlayers,

                availableSlots:
                    Math.max(
                        tournament.maxSlots -
                        verifiedPlayers,
                        0
                    )

            }

        });

    } catch (error) {

        console.log(
            "❌ Get selected tournament error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load tournament"

        });

    }

}

);

// ==========================================
// ADMIN — DASHBOARD STATISTICS
// ==========================================

app.get(
"/api/admin/dashboard",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        let tournament = null;

        if (
            req.query.tournamentId &&
            mongoose.Types.ObjectId.isValid(
                req.query.tournamentId
            )
        ) {

            tournament =
                await Tournament
                    .findById(
                        req.query.tournamentId
                    )
                    .lean();

        }

        if (!tournament) {

            tournament =
                await Tournament
                    .findOne({})
                    .sort({
                        createdAt: -1
                    })
                    .lean();

        }

        if (!tournament) {

            return res.json({

                success: true,

                tournament: null,

                statistics: {

                    totalPlayers: 0,

                    verifiedPlayers: 0,

                    pendingPlayers: 0,

                    rejectedPlayers: 0,

                    availableSlots: 0

                }

            });

        }

        const [
            totalPlayers,
            verifiedPlayers,
            pendingPlayers,
            rejectedPlayers
        ] =
            await Promise.all([

                Player.countDocuments({
                    tournamentId:
                        tournament._id
                }),

                Player.countDocuments({
                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "VERIFIED"
                }),

                Player.countDocuments({
                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "PENDING"
                }),

                Player.countDocuments({
                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "REJECTED"
                })

            ]);

        const availableSlots =
            Math.max(
                tournament.maxSlots -
                verifiedPlayers,
                0
            );

        return res.json({

            success: true,

            tournament: {

                id:
                    tournament._id,

                name:
                    tournament.name,

                date:
                    tournament.date,

                time:
                    tournament.time,

                entryFee:
                    tournament.entryFee,

                maxSlots:
                    tournament.maxSlots,

                registeredPlayers:
                    verifiedPlayers,

                registrationStatus:
                    tournament.registrationStatus

            },

            statistics: {

                totalPlayers:
                    totalPlayers,

                verifiedPlayers:
                    verifiedPlayers,

                pendingPlayers:
                    pendingPlayers,

                rejectedPlayers:
                    rejectedPlayers,

                availableSlots:
                    availableSlots

            }

        });

    } catch (error) {

        console.log(
            "❌ Dashboard error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to load dashboard"

        });

    }

}

);

// ==========================================
// ADMIN — GET PLAYERS
// NOW SUPPORTS TOURNAMENT FILTER
// ==========================================

app.get(
"/api/admin/players",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const filter = {};

        if (req.query.tournamentId) {

            if (
                !mongoose.Types.ObjectId.isValid(
                    req.query.tournamentId
                )
            ) {

                return res.status(400).json({

                    success: false,

                    message:
                        "Invalid tournament ID"

                });

            }

            filter.tournamentId =
                req.query.tournamentId;

        }

        const players =
            await Player
                .find(filter)
                .populate("tournamentId")
                .sort({
                    createdAt: -1
                })
                .lean();

        return res.json({

            success: true,

            players:
                players

        });

    } catch (error) {

        console.log(
            "❌ Get players error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Server error"

        });

    }

}

);

// ==========================================
// ADMIN — VERIFY PLAYER
// ==========================================

app.post(
"/api/admin/players/:playerId/verify",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const player =
            await Player
                .findById(
                    req.params.playerId
                )
                .select("+accessToken");

        if (!player) {

            return res.status(404).json({

                success: false,

                message:
                    "Player not found"

            });

        }

        if (
            player.paymentStatus ===
            "VERIFIED"
        ) {

            return res.json({

                success: true,

                message:
                    "Player already verified",

                slotNumber:
                    player.slotNumber

            });

        }

        const tournament =
            await Tournament.findById(
                player.tournamentId
            );

        if (!tournament) {

            return res.status(404).json({

                success: false,

                message:
                    "Tournament not found"

            });

        }

        if (
            tournament.registeredPlayers >=
            tournament.maxSlots
        ) {

            tournament.registrationStatus =
                "CLOSED";

            await tournament.save();

            return res.status(400).json({

                success: false,

                message:
                    "No slots available. Tournament is full."

            });

        }

        const usedSlots =
            await Player
                .find({

                    tournamentId:
                        tournament._id,

                    paymentStatus:
                        "VERIFIED",

                    slotNumber:
                        {
                            $ne: null
                        }

                })
                .select("slotNumber")
                .lean();

        const usedNumbers =
            new Set(
                usedSlots.map(
                    p => p.slotNumber
                )
            );

        let nextSlot = null;

        for (
            let i = 1;
            i <= tournament.maxSlots;
            i++
        ) {

            if (
                !usedNumbers.has(i)
            ) {

                nextSlot = i;

                break;

            }

        }

        if (!nextSlot) {

            tournament.registrationStatus =
                "CLOSED";

            await tournament.save();

            return res.status(400).json({

                success: false,

                message:
                    "No free slot found"

            });

        }

        player.paymentStatus =
            "VERIFIED";

        player.slotNumber =
            nextSlot;

        if (!player.accessToken) {

            player.accessToken =
                crypto
                    .randomBytes(32)
                    .toString("hex");

        }

        await player.save();

        tournament.registeredPlayers += 1;

        if (
            tournament.registeredPlayers >=
            tournament.maxSlots
        ) {

            tournament.registeredPlayers =
                tournament.maxSlots;

            tournament.registrationStatus =
                "CLOSED";

            console.log(
                "🔒 Tournament automatically CLOSED because all slots are full"
            );

        }

        await tournament.save();

        console.log(
            `✅ Player verified. Slot: ${nextSlot}`
        );

        return res.json({

            success: true,

            message:
                "Payment verified successfully",

            slotNumber:
                nextSlot,

            registrationStatus:
                tournament.registrationStatus,

            registeredPlayers:
                tournament.registeredPlayers,

            maxSlots:
                tournament.maxSlots

        });

    } catch (error) {

        console.log(
            "❌ Verify player error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to verify player"

        });

    }

}

);

// ==========================================
// ADMIN — REJECT PLAYER
// ==========================================

app.post(
"/api/admin/players/:playerId/reject",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const player =
            await Player.findById(
                req.params.playerId
            );

        if (!player) {

            return res.status(404).json({

                success: false,

                message:
                    "Player not found"

            });

        }

        if (
            player.paymentStatus ===
            "VERIFIED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Verified player cannot be rejected"

            });

        }

        player.paymentStatus =
            "REJECTED";

        player.slotNumber =
            null;

        await player.save();

        return res.json({

            success: true,

            message:
                "Player rejected"

        });

    } catch (error) {

        console.log(
            "❌ Reject player error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to reject player"

        });

    }

}

);

// ==========================================
// ADMIN — CHANGE REGISTRATION STATUS
// ==========================================

app.post(
"/api/admin/tournaments/:tournamentId/status",
requireAdmin,
async (req, res) => {

    try {

        if (!isDatabaseConnected()) {

            return res.status(503).json({

                success: false,

                message:
                    "Database is not connected"

            });

        }

        const {
            status
        } = req.body;

        if (
            status !== "OPEN" &&
            status !== "CLOSED"
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Status must be OPEN or CLOSED"

            });

        }

        const tournament =
            await Tournament.findById(
                req.params.tournamentId
            );

        if (!tournament) {

            return res.status(404).json({

                success: false,

                message:
                    "Tournament not found"

            });

        }

        if (
            status === "OPEN" &&
            tournament.registeredPlayers >=
            tournament.maxSlots
        ) {

            tournament.registrationStatus =
                "CLOSED";

            await tournament.save();

            return res.status(400).json({

                success: false,

                message:
                    "Tournament is already full, so it cannot be opened"

            });

        }

        tournament.registrationStatus =
            status;

        await tournament.save();

        return res.json({

            success: true,

            message:
                `Tournament registration ${status}`,

            registrationStatus:
                tournament.registrationStatus

        });

    } catch (error) {

        console.log(
            "❌ Change tournament status error:",
            error.message
        );

        return res.status(500).json({

            success: false,

            message:
                "Unable to change tournament status"

        });

    }

}

);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get(
"/api/health",
(req, res) => {

    res.json({

        success: true,

        server:
            "ONLINE",

        database:
            isDatabaseConnected()
                ? "CONNECTED"
                : "DISCONNECTED"

    });

}

);

// ==========================================
// START SERVER
// ==========================================

app.listen(
PORT,
() => {

    console.log(
        `🔥 Free Fire Tournament Server running at http://localhost:${PORT}`
    );

}

);
