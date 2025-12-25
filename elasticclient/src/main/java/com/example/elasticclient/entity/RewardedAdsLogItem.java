package com.example.elasticclient.entity;

import java.util.Date;

public class RewardedAdsLogItem {
    public String userId;
    public String platform;
    public String country;
    public String gameVersion;
    public String level;
    public int loggedDay;
    public Date accountCreatedDate;
    public String placement;
    public String subPlacement;

    public RewardedAdsLogItem() {
    }

    public RewardedAdsLogItem(String userId, String platform, String country, String gameVersion, String level,
            int loggedDay, Date accountCreatedDate, String placement, String subPlacement) {
        this.userId = userId;
        this.platform = platform;
        this.country = country;
        this.gameVersion = gameVersion;
        this.level = level;
        this.loggedDay = loggedDay;
        this.accountCreatedDate = accountCreatedDate;
        this.placement = placement;
        this.subPlacement = subPlacement;
    }
}
