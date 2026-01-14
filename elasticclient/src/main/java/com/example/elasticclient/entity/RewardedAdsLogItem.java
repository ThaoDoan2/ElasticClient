package com.example.elasticclient.entity;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RewardedAdsLogItem {
    public String userId;
    public String platform;
    public String country;
    public String gameVersion;
    public String level;
    public int loggedDay;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date date;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date accountCreatedDate;
    public String placement;
    public String subPlacement;

    public RewardedAdsLogItem() {
    }

    public RewardedAdsLogItem(String userId, String platform, String country, String gameVersion, String level,
            int loggedDay, Date accountCreatedDate, Date date, String placement, String subPlacement) {
        this.userId = userId;
        this.platform = platform;
        this.country = country;
        this.gameVersion = gameVersion;
        this.level = level;
        this.loggedDay = loggedDay;
        this.accountCreatedDate = accountCreatedDate;
        this.date = date;
        this.placement = placement;
        this.subPlacement = subPlacement;
    }
}
