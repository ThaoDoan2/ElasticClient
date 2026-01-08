package com.example.elasticclient.entity;


import java.util.Date;

import com.fasterxml.jackson.annotation.JsonFormat;

public class IapLogItem {
    public String userId;
    public String gameId;
    public String eventType;
    public String placement;
    public String subPlacement;
    public String platform;
    public String gameVersion;
    public int level;
    public int loggedDay;
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date accountCreatedDate;

    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd'T'HH:mm:ss.SSSX", timezone = "UTC")
    public Date date;

    
    public String productId;
    public String transactionId;
    public String orderId;
    public String purchaseState;
    public String receipt;
    public String currencyCode;
    public String purchaseToken;
    public float price;

    public IapLogItem() {
    }

    public IapLogItem(String userId, String gameId, String eventType, String placement, String subPlacement,
            String platform, String gameVersion, int level, int loggedDay, Date accountCreatedDate, Date date, String productId,
            String transactionId, String orderId, String purchaseState, String receipt, String currencyCode,
            String purchaseToken, float price) {
        this.userId = userId;
        this.gameId = gameId;
        this.eventType = eventType;
        this.placement = placement;
        this.subPlacement = subPlacement;
        this.platform = platform;
        this.gameVersion = gameVersion;
        this.level = level;
        this.loggedDay = loggedDay;
        this.accountCreatedDate = accountCreatedDate;
        this.date = date;
        this.productId = productId;
        this.transactionId = transactionId;
        this.orderId = orderId;
        this.purchaseState = purchaseState;
        this.receipt = receipt;
        this.currencyCode = currencyCode;
        this.purchaseToken = purchaseToken;
        this.price = price;
    }
}
