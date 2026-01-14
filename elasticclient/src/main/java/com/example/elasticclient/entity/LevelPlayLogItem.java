package com.example.elasticclient.entity;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public class LevelPlayLogItem {
    @JsonProperty("userId")
    public String userId;

    @JsonProperty("platform")
    public String platform;

    @JsonProperty("country")
    public String country;

    @JsonProperty("gameVersion")
    public String gameVersion;

    @JsonProperty("loggedDay")
    public int loggedDay;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date date;

    @JsonProperty("accountCreatedDate")
    public Date accountCreatedDate;

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
