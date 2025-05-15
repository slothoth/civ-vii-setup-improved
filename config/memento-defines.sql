CREATE TABLE LeaderMementoSynergy (
    LeaderType TEXT  not null,
    MementoType TEXT not null,
    AgeType TEXT,
    PRIMARY KEY (LeaderType, MementoType)
    -- FOREIGN KEY (LeaderType) REFERENCES Leaders(LeaderType),
    -- FOREIGN KEY (MementoType) REFERENCES Mementos(Type)
);

CREATE TABLE CivMementoSynergy (
    CivilizationType TEXT not null,
    MementoType TEXT not null,
    PRIMARY KEY (CivilizationType, MementoType)
    -- FOREIGN KEY (CivilizationType) REFERENCES Civilizations(CivilizationType),
    -- FOREIGN KEY (MementoType) REFERENCES Mementos(Type)
);

-- Memento - Memento synergy
CREATE TABLE MementoSetSynergy (
    MementoTypePrimary TEXT not null,
    MementoTypeSecondary TEXT not null,
    PRIMARY KEY (MementoTypePrimary, MementoTypeSecondary)
    -- FOREIGN KEY (MementoTypePrimary) REFERENCES Mementos(Type),
    -- FOREIGN KEY (MementoTypeSecondary) REFERENCES Mementos(Type),
);

-- Predefined Memento combinations for civs or leaders
CREATE TABLE SpecificMementoCombo (
    ComboID TEXT PRIMARY KEY,
    LeaderType  TEXT not null,
    CivilizationType  TEXT,
    MementoTypePrimary TEXT not null,
    MementoTypeSecondary TEXT not null,
    AgeType TEXT
    -- FOREIGN KEY (MementoTypePrimary) REFERENCES Mementos(Type),
    -- FOREIGN KEY (MementoTypeSecondary) REFERENCES Mementos(Type),
    -- FOREIGN KEY (LeaderType) REFERENCES Leaders(LeaderType),
    -- FOREIGN KEY (CivilizationType) REFERENCES Civilizations(CivilizationType),
);