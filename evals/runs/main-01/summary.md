# eval summary

- run: main-01
- 記録数: 360
- config: C0, C0p, C1, C2, C3, C4

## config ごとの集計

| config | model | runs | schemaOk | quote 一致 | hit@line | hit@±2 | hit@file | 未対応/run | 不在パス | dropped comments | dropped context | 平均 wall (s) | prompt tokens (最大) | context 残余 (最小) | thinking tokens (平均) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C0 | qwen3:14b, - | 60 | 88% | 84% | 62% | 69% | 79% | 0.45 | 0 | 0 | 0 | 53.2 | 26712 | 6056 | - |
| C0p | qwen3:14b, - | 60 | 93% | 70% | 48% | 74% | 88% | 0.32 | 0 | 0 | 0 | 37.9 | 26696 | 6072 | - |
| C1 | gemma4:12b, - | 60 | 93% | 100% | 83% | 90% | 90% | 0.20 | 0 | 0 | 0 | 79.9 | 22413 | 10355 | - |
| C2 | gemma4:12b | 60 | 100% | 100% | 71% | 79% | 93% | 0.48 | 0 | 0 | 0 | 2.5 | 30863 | 1905 | - |
| C3 | qwen3.5:9b, - | 60 | 80% | 81% | 57% | 71% | 71% | 0.75 | 0 | 0 | 0 | 73.1 | 14921 | 17847 | - |
| C4 | gpt-oss:20b, - | 60 | 78% | 94% | 64% | 83% | 83% | 0.70 | 0 | 3 | 0 | 94.5 | 30589 | 2179 | - |

## case 別 hit@±2 (命中した expected / expected 総数)

| case | C0 | C0p | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- | --- |
| clean-bugfix-05 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| clean-dependency-update-06 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| clean-refactor-01 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| clean-rename-02 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| clean-tests-added-03 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| clean-type-annotations-04 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 | 0/0 |
| concurrency-floating-promise-02 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| concurrency-race-01 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| convention-forbidden-api-02 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| convention-nondeterminism-01 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| dataflow-lost-update-02 | 0/3 | 1/3 | 3/3 | 0/3 | 0/3 | 3/3 |
| dataflow-stale-value-01 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| error-swallowed-01 | 1/3 | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| error-unhandled-rejection-02 | 3/3 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 |
| logic-boundary-02 | 3/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 |
| logic-inversion-01 | 2/3 | 3/3 | 3/3 | 0/3 | 3/3 | 3/3 |
| resource-listener-leak-01 | 0/3 | 0/3 | 3/3 | 3/3 | 3/3 | 0/3 |
| resource-unclosed-handle-02 | 0/3 | 0/3 | 3/3 | 3/3 | 0/3 | 3/3 |
| size-large-02 | 3/3 | 1/3 | 0/3 | 3/3 | 0/3 | 0/3 |
| size-small-01 | 3/3 | 3/3 | 2/3 | 3/3 | 3/3 | 2/3 |

## case 別 未対応コメント数 (clean case では false positive 候補)

| case | C0 | C0p | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- | --- |
| clean-bugfix-05 | 1.00 | 1.00 | 0.00 | 2.00 | 2.00 | 2.00 |
| clean-dependency-update-06 | 0.00 | 0.67 | 0.00 | 1.00 | 4.00 | 0.00 |
| clean-refactor-01 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 1.00 |
| clean-rename-02 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| clean-tests-added-03 | 1.33 | 0.67 | 0.00 | 1.00 | 0.00 | 0.00 |
| clean-type-annotations-04 | 0.00 | 0.67 | 0.00 | 0.00 | 0.00 | 3.00 |
| concurrency-floating-promise-02 | 2.67 | 0.67 | 0.00 | 0.00 | 0.00 | 1.00 |
| concurrency-race-01 | 0.00 | 0.00 | 0.00 | 0.67 | 1.00 | 1.00 |
| convention-forbidden-api-02 | 0.67 | 0.67 | 1.00 | 0.00 | 1.00 | 2.00 |
| convention-nondeterminism-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| dataflow-lost-update-02 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 |
| dataflow-stale-value-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 |
| error-swallowed-01 | 0.67 | 0.33 | 1.00 | 0.00 | 1.00 | 1.00 |
| error-unhandled-rejection-02 | 1.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| logic-boundary-02 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 0.00 |
| logic-inversion-01 | 0.00 | 0.00 | 0.00 | 1.00 | 0.00 | 1.00 |
| resource-listener-leak-01 | 0.67 | 1.00 | 2.00 | 2.00 | 5.00 | 0.00 |
| resource-unclosed-handle-02 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 1.00 |
| size-large-02 | 1.00 | 0.67 | 0.00 | 0.00 | 0.00 | 0.00 |
| size-small-01 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |

## case 別 quote 一致率

| case | C0 | C0p | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- | --- |
| clean-bugfix-05 | 100% | 100% | - | 100% | 0% | 50% |
| clean-dependency-update-06 | - | 100% | - | 100% | 100% | - |
| clean-refactor-01 | - | - | - | 100% | - | 100% |
| clean-rename-02 | - | - | - | - | - | - |
| clean-tests-added-03 | 0% | 0% | - | 100% | - | - |
| clean-type-annotations-04 | - | 100% | - | - | - | 100% |
| concurrency-floating-promise-02 | 100% | 100% | 100% | 100% | 100% | 100% |
| concurrency-race-01 | 0% | 17% | 100% | 100% | 100% | 100% |
| convention-forbidden-api-02 | 100% | 60% | 100% | 100% | 67% | 100% |
| convention-nondeterminism-01 | 100% | 33% | 100% | 100% | 100% | 100% |
| dataflow-lost-update-02 | - | 100% | 100% | - | 100% | 100% |
| dataflow-stale-value-01 | 100% | 100% | 100% | 100% | 100% | 100% |
| error-swallowed-01 | 33% | 100% | 100% | 100% | 100% | 100% |
| error-unhandled-rejection-02 | 100% | 100% | 100% | 100% | - | 100% |
| logic-boundary-02 | 100% | 33% | 100% | 100% | 100% | 100% |
| logic-inversion-01 | 100% | 100% | 100% | 100% | 100% | 100% |
| resource-listener-leak-01 | 100% | 100% | 100% | 100% | 67% | - |
| resource-unclosed-handle-02 | - | - | 100% | 100% | - | 100% |
| size-large-02 | 83% | 100% | - | 100% | - | - |
| size-small-01 | 100% | 0% | 100% | 100% | 100% | 0% |

## case 別 平均 wall (s)

| case | C0 | C0p | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- | --- |
| clean-bugfix-05 | 21.9 | 13.5 | 101.5 | 2.8 | 94.7 | 102.6 |
| clean-dependency-update-06 | 21.2 | 15.1 | 77.0 | 2.0 | 8.4 | 231.2 |
| clean-refactor-01 | 21.1 | 11.6 | 39.3 | 2.1 | 31.0 | 31.2 |
| clean-rename-02 | 17.1 | 5.7 | 35.7 | 1.1 | 33.2 | 231.1 |
| clean-tests-added-03 | 34.6 | 33.5 | 280.5 | 3.4 | 110.5 | 40.9 |
| clean-type-annotations-04 | 300.1 | 217.1 | 69.0 | 1.3 | 276.1 | 75.2 |
| concurrency-floating-promise-02 | 20.0 | 15.0 | 100.7 | 2.2 | 29.4 | 85.3 |
| concurrency-race-01 | 112.3 | 22.9 | 68.8 | 3.0 | 90.0 | 84.4 |
| convention-forbidden-api-02 | 24.5 | 24.6 | 59.1 | 2.4 | 8.6 | 114.4 |
| convention-nondeterminism-01 | 6.6 | 7.0 | 28.8 | 1.9 | 7.9 | 15.4 |
| dataflow-lost-update-02 | 25.9 | 18.9 | 110.0 | 0.9 | 17.4 | 214.9 |
| dataflow-stale-value-01 | 7.0 | 5.5 | 18.1 | 2.0 | 5.2 | 16.6 |
| error-swallowed-01 | 7.8 | 8.0 | 60.1 | 2.0 | 8.3 | 46.1 |
| error-unhandled-rejection-02 | 16.2 | 17.8 | 73.5 | 2.5 | 272.4 | 46.3 |
| logic-boundary-02 | 19.1 | 21.3 | 43.7 | 2.4 | 74.5 | 47.9 |
| logic-inversion-01 | 18.2 | 9.3 | 81.8 | 2.2 | 21.2 | 52.0 |
| resource-listener-leak-01 | 129.0 | 37.0 | 92.8 | 4.0 | 9.7 | 226.6 |
| resource-unclosed-handle-02 | 216.7 | 235.5 | 94.4 | 1.9 | 276.3 | 30.0 |
| size-large-02 | 23.3 | 22.2 | 29.9 | 5.8 | 48.4 | 77.1 |
| size-small-01 | 20.7 | 16.9 | 133.0 | 3.7 | 38.5 | 120.8 |

## case 別 prompt tokens (最大) / context 残余 (最小、上限 32768)

| case | C0 | C0p | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- | --- |
| clean-bugfix-05 | 2877 / 29891 | 2225 / 30543 | 9097 / 23671 | 1407 / 31361 | 12179 / 20589 | 16038 / 16730 |
| clean-dependency-update-06 | 2665 / 30103 | 2078 / 30690 | 7183 / 25585 | 1190 / 31578 | 1679 / 31089 | - |
| clean-refactor-01 | 2190 / 30578 | 1432 / 31336 | 3664 / 29104 | 628 / 32140 | 4175 / 28593 | 7142 / 25626 |
| clean-rename-02 | 2338 / 30430 | 1609 / 31159 | 3926 / 28842 | 1192 / 31576 | 4947 / 27821 | - |
| clean-tests-added-03 | 3683 / 29085 | 3617 / 29151 | 22413 / 10355 | 969 / 31799 | 13865 / 18903 | 6997 / 25771 |
| clean-type-annotations-04 | - | 4675 / 28093 | 6477 / 26291 | 1146 / 31622 | - | 11739 / 21029 |
| concurrency-floating-promise-02 | 3521 / 29247 | 3463 / 29305 | 9966 / 22802 | 2490 / 30278 | 5485 / 27283 | 14232 / 18536 |
| concurrency-race-01 | 2869 / 29899 | 3180 / 29588 | 7079 / 25689 | 1959 / 30809 | 11943 / 20825 | 13687 / 19081 |
| convention-forbidden-api-02 | 3446 / 29322 | 3422 / 29346 | 6141 / 26627 | 1843 / 30925 | 2373 / 30395 | 17889 / 14879 |
| convention-nondeterminism-01 | 1437 / 31331 | 1542 / 31226 | 3259 / 29509 | 1137 / 31631 | 1767 / 31001 | 3200 / 29568 |
| dataflow-lost-update-02 | 3178 / 29590 | 3141 / 29627 | 9676 / 23092 | 1333 / 31435 | 2989 / 29779 | 30589 / 2179 |
| dataflow-stale-value-01 | 1197 / 31571 | 1138 / 31630 | 2223 / 30545 | 936 / 31832 | 1321 / 31447 | 3116 / 29652 |
| error-swallowed-01 | 1831 / 30937 | 1798 / 30970 | 5921 / 26847 | 1471 / 31297 | 2032 / 30736 | 7909 / 24859 |
| error-unhandled-rejection-02 | 2747 / 30021 | 3009 / 29759 | 7311 / 25457 | 1755 / 31013 | - | 8209 / 24559 |
| logic-boundary-02 | 3108 / 29660 | 3322 / 29446 | 4744 / 28024 | 1521 / 31247 | 9901 / 22867 | 8300 / 24468 |
| logic-inversion-01 | 2192 / 30576 | 1461 / 31307 | 7233 / 25535 | 994 / 31774 | 3241 / 29527 | 8427 / 24341 |
| resource-listener-leak-01 | 4903 / 27865 | 5588 / 27180 | 9118 / 23650 | 2339 / 30429 | 2585 / 30183 | - |
| resource-unclosed-handle-02 | 4782 / 27986 | 8848 / 23920 | 8409 / 24359 | 1249 / 31519 | - | 5335 / 27433 |
| size-large-02 | 26712 / 6056 | 26696 / 6072 | - | 30863 / 1905 | - | - |
| size-small-01 | 11681 / 21087 | 11092 / 21676 | 16108 / 16660 | 12028 / 20740 | 14921 / 17847 | 21437 / 11331 |

残余が負の config は、prompt が context を実際に超えています。
tokenizer の密度はモデルごとに違うため、同じ入力でも config によって超えるかどうかが変わります。

## case 別 dropped context files

| case | C0 | C0p | C1 | C2 | C3 | C4 |
| --- | --- | --- | --- | --- | --- | --- |
| clean-bugfix-05 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-dependency-update-06 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-refactor-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-rename-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-tests-added-03 | 0 | 0 | 0 | 0 | 0 | 0 |
| clean-type-annotations-04 | 0 | 0 | 0 | 0 | 0 | 0 |
| concurrency-floating-promise-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| concurrency-race-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| convention-forbidden-api-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| convention-nondeterminism-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| dataflow-lost-update-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| dataflow-stale-value-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| error-swallowed-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| error-unhandled-rejection-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| logic-boundary-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| logic-inversion-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| resource-listener-leak-01 | 0 | 0 | 0 | 0 | 0 | 0 |
| resource-unclosed-handle-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| size-large-02 | 0 | 0 | 0 | 0 | 0 | 0 |
| size-small-01 | 0 | 0 | 0 | 0 | 0 | 0 |

判定は自動指標だけでは決まりません。
true positive と false positive の別は `adjudication.md` を盲検で採点してから判断してください。
