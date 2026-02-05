package com.example.elasticclient;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.example.elasticclient.config.ElasticsearchConfig;
import com.example.elasticclient.entity.IapLogItem;
import com.example.elasticclient.entity.InAppChartDTO;
import com.example.elasticclient.entity.LevelPlayLogItem;
import com.example.elasticclient.entity.RewardedAdsLogItem;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.elasticsearch._types.aggregations.CalendarInterval;
import co.elastic.clients.elasticsearch._types.query_dsl.MatchQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import co.elastic.clients.elasticsearch._types.query_dsl.RangeQuery;
import co.elastic.clients.elasticsearch.core.IndexResponse;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import co.elastic.clients.elasticsearch.core.search.Hit;

public class ElasticSearchConnect {

    String serverUrl;
    String userName;
    String password;
    ElasticsearchClient esClient;

    public ElasticSearchConnect() {
        new ElasticsearchConfig().LoadConfig();
        serverUrl = ElasticsearchConfig.host;
        userName = ElasticsearchConfig.userName;
        password = ElasticsearchConfig.password;
    }

    public void Connect() {
        esClient = ElasticsearchClient.of(b -> b
                .host(serverUrl)
                .usernameAndPassword(userName, password));
    }

    public void Search() {

        try {
            Query byName = MatchQuery.of(m -> m
                    .field("gameId")
                    .query("game1"))._toQuery();
            RangeQuery dateRangeQuery = RangeQuery.of(r -> r.date(d -> d.field("date")
                    .gte("2026-01-01").lte("2026-02-05")));
            SearchResponse<IapLogItem> search = esClient.search(s -> s
                    .index("iap")
                    .query(q -> q.bool(b -> b.must(byName).must(dateRangeQuery))), IapLogItem.class);

            for (Hit<IapLogItem> hit : search.hits().hits()) {
                System.out.println(hit.source().productId);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

    }

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

                    // if (country != null)
                    //     b.filter(f -> f.term(t -> t.field("country.keyword").value(country)));

                    // if (version != null)
                    //     b.filter(f -> f.term(t -> t.field("version.keyword").value(version)));

                    // if (platform != null)
                    //     b.filter(f -> f.term(t -> t.field("platform.keyword").value(platform)));

                    // if (products != null && !products.isEmpty())
                    //     b.filter(f -> f.terms(t -> t.field("productId.keyword")
                    //             .terms(v -> v.value(products.stream().map(FieldValue::of).toList()))));
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
            result.add(new InAppChartDTO(b.keyAsString(), map));
            System.out.println(b.keyAsString()+" "+ b.toString());
        }

        return result;
    }

    public void onRewardedAds(String id, RewardedAdsLogItem rewardedAdsLogItem) {
        try {
            IndexResponse response = esClient.index(i -> i.index("rewarded_ads_2")
                    .id(id).document(rewardedAdsLogItem));

            System.out.println("Indexed with version " + response.version());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void deleteRewardedAds(String id) {
        try {
            esClient.delete(d -> d.index("rewarded_ads_2").id(id));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void onLevelLog(String id, LevelPlayLogItem levelPlayLogItem) {
        try {
            IndexResponse response = esClient.index(i -> i.index("level_play")
                    .id(id).document(levelPlayLogItem));

            System.out.println("Indexed with version " + response.version());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void onIapLog(String id, IapLogItem iapLogItem) {
        try {
            IndexResponse response = esClient.index(i -> i.index("iap")
                    .id(id).document(iapLogItem));

            System.out.println("Indexed with version " + response.version());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void deleteIapLog(String id) {
        try {
            esClient.delete(d -> d.index("iap").id(id));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
