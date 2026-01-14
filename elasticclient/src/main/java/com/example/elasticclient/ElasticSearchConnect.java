package com.example.elasticclient;

import com.example.elasticclient.config.ElasticsearchConfig;
import com.example.elasticclient.entity.IapLogItem;
import com.example.elasticclient.entity.LevelPlayLogItem;
import com.example.elasticclient.entity.RewardedAdsLogItem;

import co.elastic.clients.elasticsearch.ElasticsearchClient;
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
            SearchResponse<RewardedAdsLogItem> search = esClient.search(s -> s
                    .index("rewarded_ads"), RewardedAdsLogItem.class);

            for (Hit<RewardedAdsLogItem> hit : search.hits().hits()) {
                System.out.println(hit.source().placement);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

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

    public void deleteRewardedAds(String id){
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

    public void onIapLog(String id, IapLogItem iapLogItem){
        try {
            IndexResponse response = esClient.index(i -> i.index("iap")
                    .id(id).document(iapLogItem));

            System.out.println("Indexed with version " + response.version());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void deleteIapLog(String id){
        try {
            esClient.delete(d -> d.index("iap").id(id));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
