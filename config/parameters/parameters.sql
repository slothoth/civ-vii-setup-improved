-- base vanillla
INSERT INTO AdvancedParameters(ParameterID, Advanced) VALUES
('Age', 0),
('Difficulty', 0),
('GameSpeeds', 0),
('Map', 0),
('MapSize', 0),
('AgeLength', 1),
('DisasterIntensity', 1),
('CrisesEnabled', 1),
('GameRandomSeed', 1),
('MapRandomSeed', 1),
('StartPosition', 1);

INSERT INTO Parameters (ParameterID, Name, Description, Domain, Hash, Array, DefaultValue, ConfigurationGroup, ConfigurationKey, GroupID, SortIndex) VALUES
('AiMementos', 'LOC_ADVANCED_OPTIONS_AI_MEMENTO', 'LOC_AI_MEMENTO_DESC', 'bool', 0, 0, 1, 'Game', 'AiMementos', 'AdvancedOptions', 2080);

INSERT INTO AdvancedParameters(ParameterID, Advanced) VALUES
('AiMementos', 1);
