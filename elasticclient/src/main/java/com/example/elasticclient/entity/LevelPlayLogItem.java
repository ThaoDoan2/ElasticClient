package com.example.elasticclient.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LevelPlayLogItem extends LogItem {
    @JsonProperty("difficulty")
    public String difficulty;

    @JsonProperty("duration")
    public int duration;

    @JsonProperty("gameLevel")
    public int gameLevel;

    @JsonProperty("gameMode")
    public String gameMode;

    @JsonProperty("status")
    public String status;
}
