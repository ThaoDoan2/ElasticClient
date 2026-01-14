package com.example.elasticclient.entity;

import java.util.Date;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public class RewardedAdsLogItem extends LogItem {
    public String placement;
    public String subPlacement;

    public RewardedAdsLogItem() {
    }

    public RewardedAdsLogItem(String userId, String platform, String country, String gameVersion, int level,
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
