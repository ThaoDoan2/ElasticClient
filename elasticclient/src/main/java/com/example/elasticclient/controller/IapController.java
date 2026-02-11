package com.example.elasticclient.controller;

import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.elasticclient.service.IInAppAnalyticsService;
import com.example.elasticclient.service.InAppAnalyticsService;

@RestController
@Component

public class IapController {

    private final IInAppAnalyticsService iapService;

    public IapController(IInAppAnalyticsService iapService) {
        this.iapService = iapService;
    }

    @GetMapping("/api/iap")
    public String greeting() {
        try {
            var result = iapService.getInAppByDate("2026-01-01", "2026-02-05", "US", "", "", null);
            return result.toString();
        } catch (Exception e) {
            return e.getMessage();
        }
    }
}
