create table SlthLeaderCivPriorities
(
    CivilizationType TEXT    not null,
    LeaderType       TEXT    not null,
    Priority     INTEGER not null,
    primary key (CivilizationType, LeaderType)
    -- FOREIGN KEY (Civilization) REFERENCES Civilizations(CivilizationType),
    -- FOREIGN KEY (Leader) REFERENCES Leaders(LeaderType)
);