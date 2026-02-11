package com.example.elasticclient.service;

import co.elastic.clients.json.JsonData;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.elasticclient.entity.InAppChartDTO;

import co.elastic.clients.elasticsearch._types.FieldValue;
import co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;
import co.elastic.clients.elasticsearch._types.query_dsl.RangeQuery;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.ElasticsearchClient;

@Service
public class InAppAnalyticsService implements IInAppAnalyticsService {

    @Autowired
    private ElasticsearchClient esClient;

    

    public List<InAppChartDTO> getInAppByDate(
            String from, String to,
            String country,
            String version,
            String platform,
            List<String> products) throws IOException {

        RangeQuery dateRangeQuery = RangeQuery.of(r -> r.date(d -> d.field("date")
                .gte("2026-01-01").lte("2026-02-05")));
        SearchResponse<Void> response = esClient.search(s -> s
                .index("iap")
                .size(0)
                .query(q -> q.bool(b -> {
                    b.must(dateRangeQuery);

                    if (country != null)
                        b.filter(f -> f.term(t -> t.field("country.keyword").value(country)));

                    if (version != null)
                        b.filter(f -> f.term(t -> t.field("version.keyword").value(version)));

                    if (platform != null)
                        b.filter(f -> f.term(t -> t.field("platform.keyword").value(platform)));

                    if (products != null && !products.isEmpty())
                        b.filter(f -> f.terms(t -> t.field("productId.keyword")
                                .terms(v -> v.value(products.stream().map(FieldValue::of).toList()))));
                    return b;
                }))
                .aggregations("by_date", a -> a
                        .dateHistogram(d -> d.field("date").calendarInterval(CalendarInterval.Day))
                        .aggregations("by_product", a2 -> a2
                                .terms(t -> t.field("productId.keyword").size(20)))),
                Void.class);

        List<InAppChartDTO> result = new ArrayList<>();

        var buckets = response.aggregations()
                .get("by_date")
                .dateHistogram()
                .buckets().array();

        for (var b : buckets) {
            Map<String, Long> map = new HashMap<>();

            var productsAgg = b.aggregations()
                    .get("by_product")
                    .histogram()
                    .buckets().array();

            for (var p : productsAgg) {
                map.put(p.keyAsString(), p.docCount());
            }

            result.add(new InAppChartDTO(b.keyAsString(), map));
        }

        return result;
    }
}
