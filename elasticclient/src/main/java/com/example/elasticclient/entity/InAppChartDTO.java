package com.example.elasticclient.entity;

import java.util.Map;

public class InAppChartDTO {
    private String date;
    private Map<String, Long> products;

    public InAppChartDTO() {
    }

    public InAppChartDTO(String date, Map<String, Long> products) {
        this.date = date;
        this.products = products;
    }

    public String getDate() { return date; }
    public void setDate(String date) { this.date = date; }

    public Map<String, Long> getProducts() { return products; }
    public void setProducts(Map<String, Long> products) { this.products = products; }
}