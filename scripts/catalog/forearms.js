/**
 * Canonical Forearms / Grip exercise catalog.
 *
 * Hammer curls and reverse curls live in the Biceps catalog — do not duplicate.
 * They remain discoverable via FOREARMS_CROSS_CATEGORY_ALIASES / search.
 */

/** @typedef {{
 *   name: string,
 *   muscleGroup: "Forearms",
 *   equipment: string,
 *   movementType: string,
 *   primaryMuscles: string[],
 *   secondaryMuscles: string[],
 *   aliases?: string[],
 *   instructions?: string,
 * }} ForearmsCatalogEntry */

/** @type {ForearmsCatalogEntry[]} */
const FOREARMS_CATALOG = [
    // ── Wrist curls (flexors) ────────────────────────────────────────────────
    {
        name: "Barbell Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Wrist Curl", "BB Wrist Curl", "Seated Barbell Wrist Curl", "Forearm Curl"],
        instructions:
            "Sit with forearms on thighs or a bench, palms up, holding a barbell. Curl the wrists upward, then lower under control.",
    },
    {
        name: "Dumbbell Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["DB Wrist Curl"],
        instructions: "With palms up and forearms supported, curl the dumbbells by flexing the wrists, then lower slowly.",
    },
    {
        name: "Single Arm Dumbbell Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Single-Arm Dumbbell Wrist Curl", "One Arm Wrist Curl"],
    },
    {
        name: "Cable Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: [],
    },
    {
        name: "Single Arm Cable Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Single-Arm Cable Wrist Curl"],
    },
    {
        name: "Behind the Back Barbell Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Behind-the-Back Barbell Wrist Curl", "Behind Back Wrist Curl"],
        instructions: "Hold a barbell behind the hips with palms facing back and curl the wrists upward.",
    },
    {
        name: "Behind the Back Cable Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Behind-the-Back Cable Wrist Curl"],
    },
    {
        name: "Machine Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Machine",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Wrist Curl Machine"],
    },

    // ── Reverse wrist curls (extensors) ──────────────────────────────────────
    {
        name: "Barbell Reverse Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Reverse Wrist Curl", "BB Reverse Wrist Curl", "Overhand Wrist Curl"],
        instructions:
            "Sit with forearms supported, palms down on a barbell. Extend the wrists upward, then lower under control.",
    },
    {
        name: "Dumbbell Reverse Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: ["DB Reverse Wrist Curl"],
        instructions: "With palms down and forearms supported, extend the wrists to lift the dumbbells, then lower slowly.",
    },
    {
        name: "Single Arm Dumbbell Reverse Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Single-Arm Dumbbell Reverse Wrist Curl"],
    },
    {
        name: "Cable Reverse Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: [],
    },
    {
        name: "Single Arm Cable Reverse Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: ["Single-Arm Cable Reverse Wrist Curl"],
    },
    {
        name: "Machine Reverse Wrist Curl",
        muscleGroup: "Forearms",
        equipment: "Machine",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: [],
    },

    // ── Wrist roller ─────────────────────────────────────────────────────────
    {
        name: "Wrist Roller",
        muscleGroup: "Forearms",
        equipment: "Wrist Roller",
        movementType: "Wrist Roll",
        primaryMuscles: ["wristFlexors", "wristExtensors"],
        secondaryMuscles: ["forearms", "brachioradialis"],
        aliases: ["Wrist Roll", "Forearm Roller"],
        instructions: "Hold the roller at arm's length and wind the weight up by rolling the wrists, then reverse to lower it.",
    },
    {
        name: "Wrist Roller Flexion",
        muscleGroup: "Forearms",
        equipment: "Wrist Roller",
        movementType: "Wrist Flexion",
        primaryMuscles: ["wristFlexors"],
        secondaryMuscles: ["forearms"],
        aliases: [],
    },
    {
        name: "Wrist Roller Extension",
        muscleGroup: "Forearms",
        equipment: "Wrist Roller",
        movementType: "Wrist Extension",
        primaryMuscles: ["wristExtensors"],
        secondaryMuscles: ["forearms"],
        aliases: [],
    },

    // ── Crushing grip ────────────────────────────────────────────────────────
    {
        name: "Hand Gripper",
        muscleGroup: "Forearms",
        equipment: "Gripper",
        movementType: "Crushing Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Grip Trainer", "Hand Grip", "Gripper", "Captains of Crush"],
        instructions: "Squeeze the gripper handles fully closed, pause briefly, then open under control.",
    },
    {
        name: "Adjustable Hand Gripper",
        muscleGroup: "Forearms",
        equipment: "Gripper",
        movementType: "Crushing Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Adjustable Gripper"],
    },
    {
        name: "Gripper Hold",
        muscleGroup: "Forearms",
        equipment: "Gripper",
        movementType: "Crushing Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Closed Gripper Hold"],
        instructions: "Close the gripper and hold it shut for time.",
    },
    {
        name: "Towel Squeeze",
        muscleGroup: "Forearms",
        equipment: "Towel",
        movementType: "Crushing Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Towel Crush"],
    },

    // ── Pinch grip ───────────────────────────────────────────────────────────
    {
        name: "Plate Pinch Hold",
        muscleGroup: "Forearms",
        equipment: "Plate",
        movementType: "Pinch Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Plate Pinch", "Pinch Hold", "Plate Pinch Grip"],
        instructions: "Pinch smooth plates together with fingers and thumb and hold for time.",
    },
    {
        name: "Plate Pinch Carry",
        muscleGroup: "Forearms",
        equipment: "Plate",
        movementType: "Pinch Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps", "core"],
        aliases: ["Pinch Carry"],
        instructions: "Pinch plates and walk for distance or time while keeping a tall posture.",
    },
    {
        name: "Single Arm Plate Pinch Hold",
        muscleGroup: "Forearms",
        equipment: "Plate",
        movementType: "Pinch Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Single-Arm Plate Pinch Hold"],
    },
    {
        name: "Single Arm Plate Pinch Carry",
        muscleGroup: "Forearms",
        equipment: "Plate",
        movementType: "Pinch Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["core", "traps"],
        aliases: ["Single-Arm Plate Pinch Carry"],
    },

    // ── Hanging grip ─────────────────────────────────────────────────────────
    {
        name: "Dead Hang",
        muscleGroup: "Forearms",
        equipment: "Bodyweight",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["lats", "shoulders"],
        aliases: ["Bar Hang", "Passive Hang"],
        instructions: "Hang from a bar with arms straight and hold for time, keeping the shoulders lightly engaged.",
    },
    {
        name: "Weighted Dead Hang",
        muscleGroup: "Forearms",
        equipment: "Bodyweight",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["lats", "shoulders"],
        aliases: ["Weighted Hang"],
    },
    {
        name: "Single Arm Dead Hang",
        muscleGroup: "Forearms",
        equipment: "Bodyweight",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["lats", "core"],
        aliases: ["Single-Arm Dead Hang", "One Arm Hang"],
    },
    {
        name: "Towel Dead Hang",
        muscleGroup: "Forearms",
        equipment: "Towel",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["lats"],
        aliases: ["Towel Hang"],
    },
    {
        name: "Fat Grip Dead Hang",
        muscleGroup: "Forearms",
        equipment: "Bodyweight",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["lats"],
        aliases: ["Thick Bar Dead Hang", "Fat Bar Hang"],
    },

    // ── Carries ──────────────────────────────────────────────────────────────
    {
        name: "Farmer's Carry",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Loaded Carry",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps", "core", "shoulders"],
        aliases: [
            "Farmers Walk",
            "Farmer's Walk",
            "Farmer Walk",
            "Farmers Carry",
            "Farmer Carry",
        ],
        instructions: "Pick up a heavy implement in each hand and walk with a tall posture for distance or time.",
    },
    {
        name: "Suitcase Carry",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Loaded Carry",
        primaryMuscles: ["forearms", "core"],
        secondaryMuscles: ["traps", "obliques"],
        aliases: ["Suitcase Walk", "Single Arm Farmer's Carry"],
        instructions: "Carry a load in one hand only while keeping the torso upright and resisting side bend.",
    },
    {
        name: "Trap Bar Carry",
        muscleGroup: "Forearms",
        equipment: "Trap Bar",
        movementType: "Loaded Carry",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps", "core"],
        aliases: ["Hex Bar Carry", "Trap Bar Farmer's Walk"],
    },
    {
        name: "Dumbbell Farmer's Carry",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Loaded Carry",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps", "core"],
        aliases: ["DB Farmer's Carry", "Dumbbell Farmers Walk"],
    },
    {
        name: "Kettlebell Farmer's Carry",
        muscleGroup: "Forearms",
        equipment: "Kettlebell",
        movementType: "Loaded Carry",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps", "core"],
        aliases: ["KB Farmer's Carry", "Kettlebell Farmers Walk"],
    },
    {
        name: "Bottoms Up Kettlebell Carry",
        muscleGroup: "Forearms",
        equipment: "Kettlebell",
        movementType: "Loaded Carry",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["shoulders", "core"],
        aliases: ["Bottoms-Up Kettlebell Carry", "Bottoms Up Carry"],
        instructions: "Hold a kettlebell upside-down by the handle and walk while keeping it balanced and stable.",
    },

    // ── Pronation / supination ───────────────────────────────────────────────
    {
        name: "Dumbbell Wrist Pronation",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Pronation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Wrist Pronation", "DB Pronation"],
        instructions: "With the elbow bent and forearm supported, rotate the palm from up to down against resistance.",
    },
    {
        name: "Dumbbell Wrist Supination",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Supination",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Wrist Supination", "DB Supination"],
        instructions: "With the elbow bent and forearm supported, rotate the palm from down to up against resistance.",
    },
    {
        name: "Cable Wrist Pronation",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Pronation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: [],
    },
    {
        name: "Cable Wrist Supination",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Supination",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: [],
    },

    // ── Radial / ulnar deviation ─────────────────────────────────────────────
    {
        name: "Dumbbell Radial Deviation",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Radial Deviation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Radial Deviation"],
        instructions: "With the thumb side up, tilt the hand toward the thumb against resistance, then return.",
    },
    {
        name: "Dumbbell Ulnar Deviation",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Ulnar Deviation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Ulnar Deviation"],
        instructions: "With the pinky side leading, tilt the hand toward the pinky against resistance, then return.",
    },
    {
        name: "Cable Radial Deviation",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Radial Deviation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: [],
    },
    {
        name: "Cable Ulnar Deviation",
        muscleGroup: "Forearms",
        equipment: "Cable",
        movementType: "Ulnar Deviation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: [],
    },

    // ── Lever / sledge ───────────────────────────────────────────────────────
    {
        name: "Dumbbell Wrist Lever",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Wrist Lever",
        primaryMuscles: ["forearms", "wristFlexors", "wristExtensors"],
        secondaryMuscles: [],
        aliases: ["Wrist Lever", "DB Lever"],
        instructions: "Hold a dumbbell by one end like a lever and control slow wrist rotations or tilts.",
    },
    {
        name: "Sledgehammer Wrist Lever",
        muscleGroup: "Forearms",
        equipment: "Sledgehammer",
        movementType: "Wrist Lever",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: ["Sledge Lever", "Hammer Lever"],
    },
    {
        name: "Sledgehammer Pronation",
        muscleGroup: "Forearms",
        equipment: "Sledgehammer",
        movementType: "Pronation",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: [],
    },
    {
        name: "Sledgehammer Supination",
        muscleGroup: "Forearms",
        equipment: "Sledgehammer",
        movementType: "Supination",
        primaryMuscles: ["forearms"],
        secondaryMuscles: [],
        aliases: [],
    },

    // ── Fat grip / static holds ──────────────────────────────────────────────
    {
        name: "Fat Grip Hold",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps"],
        aliases: ["Thick Bar Hold", "Fat Bar Hold"],
        instructions: "Hold a thick bar or fat-grip attachment at the sides and maintain the grip for time.",
    },
    {
        name: "Barbell Hold",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps"],
        aliases: ["Barbell Static Hold"],
        instructions: "Deadlift a barbell to a standing position and hold for time with a strong grip.",
    },
    {
        name: "Double Overhand Barbell Hold",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps"],
        aliases: ["Double Overhand Hold", "Pronated Barbell Hold"],
    },
    {
        name: "Rack Barbell Hold",
        muscleGroup: "Forearms",
        equipment: "Barbell",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps"],
        aliases: ["Rack Hold", "Pin Hold"],
        instructions: "Unrack a barbell from pins at about mid-thigh and hold for time.",
    },
    {
        name: "Dumbbell Hold",
        muscleGroup: "Forearms",
        equipment: "Dumbbell",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps"],
        aliases: ["DB Hold", "Dumbbell Static Hold"],
    },
    {
        name: "Trap Bar Hold",
        muscleGroup: "Forearms",
        equipment: "Trap Bar",
        movementType: "Support Grip",
        primaryMuscles: ["forearms"],
        secondaryMuscles: ["traps"],
        aliases: ["Hex Bar Hold"],
    },
];

/**
 * Search aliases that point at Biceps-catalog exercises (no duplicate DB rows).
 */
const FOREARMS_CROSS_CATEGORY_ALIASES = [
    { alias: "Brachioradialis Curl", name: "Hammer Curl", muscleGroup: "Biceps" },
    { alias: "Forearm Hammer Curl", name: "Hammer Curl", muscleGroup: "Biceps" },
    { alias: "Neutral Grip Forearm Curl", name: "Hammer Curl", muscleGroup: "Biceps" },
    { alias: "Cross Body Forearm Curl", name: "Cross Body Hammer Curl", muscleGroup: "Biceps" },
    { alias: "Rope Forearm Curl", name: "Rope Hammer Curl", muscleGroup: "Biceps" },
    { alias: "Reverse Curl", name: "Reverse Barbell Curl", muscleGroup: "Biceps" },
    { alias: "Overhand Curl", name: "Reverse Barbell Curl", muscleGroup: "Biceps" },
];

const FOREARMS_KEY_ALIASES = {
    // Wrist curls
    "wrist curl": "barbell wrist curl",
    "bb wrist curl": "barbell wrist curl",
    "seated barbell wrist curl": "barbell wrist curl",
    "forearm curl": "barbell wrist curl",
    "db wrist curl": "dumbbell wrist curl",
    "one arm wrist curl": "single arm dumbbell wrist curl",
    "behind back wrist curl": "behind the back barbell wrist curl",
    "wrist curl machine": "machine wrist curl",

    // Reverse wrist
    "reverse wrist curl": "barbell reverse wrist curl",
    "bb reverse wrist curl": "barbell reverse wrist curl",
    "overhand wrist curl": "barbell reverse wrist curl",
    "db reverse wrist curl": "dumbbell reverse wrist curl",

    // Roller / gripper
    "wrist roll": "wrist roller",
    "forearm roller": "wrist roller",
    "grip trainer": "hand gripper",
    "hand grip": "hand gripper",
    "gripper": "hand gripper",
    "captains of crush": "hand gripper",
    "adjustable gripper": "adjustable hand gripper",
    "closed gripper hold": "gripper hold",
    "towel crush": "towel squeeze",

    // Pinch
    "plate pinch": "plate pinch hold",
    "pinch hold": "plate pinch hold",
    "plate pinch grip": "plate pinch hold",
    "pinch carry": "plate pinch carry",

    // Hangs
    "bar hang": "dead hang",
    "passive hang": "dead hang",
    "weighted hang": "weighted dead hang",
    "one arm hang": "single arm dead hang",
    "towel hang": "towel dead hang",
    "thick bar dead hang": "fat grip dead hang",
    "fat bar hang": "fat grip dead hang",

    // Carries
    "farmers walk": "farmer carry",
    "farmer walk": "farmer carry",
    "farmers carry": "farmer carry",
    "farmer carry": "farmer carry",
    "suitcase walk": "suitcase carry",
    "single arm farmer carry": "suitcase carry",
    "hex bar carry": "trap bar carry",
    "trap bar farmer walk": "trap bar carry",
    "db farmer carry": "dumbbell farmer carry",
    "dumbbell farmers walk": "dumbbell farmer carry",
    "kb farmer carry": "kettlebell farmer carry",
    "kettlebell farmers walk": "kettlebell farmer carry",
    "bottoms up carry": "bottoms up kettlebell carry",

    // Rotation / deviation
    "wrist pronation": "dumbbell wrist pronation",
    "db pronation": "dumbbell wrist pronation",
    "wrist supination": "dumbbell wrist supination",
    "db supination": "dumbbell wrist supination",
    "radial deviation": "dumbbell radial deviation",
    "ulnar deviation": "dumbbell ulnar deviation",

    // Lever / holds
    "wrist lever": "dumbbell wrist lever",
    "db lever": "dumbbell wrist lever",
    "sledge lever": "sledgehammer wrist lever",
    "hammer lever": "sledgehammer wrist lever",
    "thick bar hold": "fat grip hold",
    "fat bar hold": "fat grip hold",
    "barbell static hold": "barbell hold",
    "double overhand hold": "double overhand barbell hold",
    "pronated barbell hold": "double overhand barbell hold",
    "rack hold": "rack barbell hold",
    "pin hold": "rack barbell hold",
    "db hold": "dumbbell hold",
    "dumbbell static hold": "dumbbell hold",
    "hex bar hold": "trap bar hold",
};

function forearmsDictionaryEntries() {
    return FOREARMS_CATALOG.map((entry) => ({
        name: entry.name,
        muscleGroup: entry.muscleGroup,
        ...(entry.instructions ? { instructions: entry.instructions } : {}),
    }));
}

function forearmsSearchAliasRows() {
    const rows = [];
    for (const entry of FOREARMS_CATALOG) {
        for (const alias of entry.aliases ?? []) {
            rows.push({
                alias,
                name: entry.name,
                muscleGroup: entry.muscleGroup,
            });
        }
    }
    for (const row of FOREARMS_CROSS_CATEGORY_ALIASES) {
        rows.push(row);
    }
    return rows;
}

function forearmsMergeTargets() {
    return FOREARMS_CATALOG.map((entry) => ({
        targetName: entry.name,
        targetMuscleGroup: entry.muscleGroup,
        sourceNames: [...new Set([...(entry.aliases ?? [])])],
    })).filter((row) => row.sourceNames.length > 0);
}

module.exports = {
    FOREARMS_CATALOG,
    FOREARMS_KEY_ALIASES,
    FOREARMS_CROSS_CATEGORY_ALIASES,
    forearmsDictionaryEntries,
    forearmsSearchAliasRows,
    forearmsMergeTargets,
};
