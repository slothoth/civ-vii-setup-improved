CREATE TABLE AdvancedParameters (
    ParameterID TEXT  not null,
    Advanced                     BOOLEAN default 0   not null,
    PRIMARY KEY (ParameterID)
    --,FOREIGN KEY (ParameterID) REFERENCES Parameters(ParameterID)
);