package com.example.elasticclient.entity;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonFormat;

public class LogItem {
    public String gameId;
    public String eventType;
    public String userId;
    public String platform;
    public String gameVersion;
    public String country;
    public int level;
    public int loggedDay;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date accountCreatedDate;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date date;

    public LogItem() {
    }

    public LogItem(String gameId, String eventType, String userId,
            String platform, String gameVersion, String country, int level, int loggedDay, Date accountCreatedDate,
            Date date) {
        this.userId = userId;
        this.gameId = gameId;
        this.eventType = eventType;
        this.platform = platform;
        this.gameVersion = gameVersion;
        this.level = level;
        this.loggedDay = loggedDay;
        this.accountCreatedDate = accountCreatedDate;
        this.date = date;
    }
}
