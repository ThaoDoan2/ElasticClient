package com.example.elasticclient.service;

import java.util.List;

import com.example.elasticclient.entity.InAppChartDTO;

public interface IInAppAnalyticsService {
    public List<InAppChartDTO> getInAppByDate(
            String from, String to,
            String country,
            String version,
            String platform,
            List<String> products) throws Exception;
}
