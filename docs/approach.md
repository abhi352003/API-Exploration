# Approach 

1. **Exploration**: All these exploration is done for v1 version same is Also done for v2 and v3

## **API Exploration and Behavior Analysis**  

Before implementing an extraction strategy, we conducted a systematic exploration of the autocomplete API at `http://35.200.185.69:8000/v1/autocomplete?query=<string>`. This helped us understand its constraints, rate limits, pagination support, and response structure.  

### **1. API Rate Limiting**  
To determine the API's rate limit, we deliberately sent multiple requests per minute and observed the server's response.  

Upon exceeding a certain threshold, the API returned:  
```json
{
    "detail": "100 per 1 minute"
}
```
This indicates that the API allows a **maximum of 100 requests per minute**.  

### **2. Pagination Support Check**  
To verify if the API supports pagination, we tested various queries:  

#### **Initial Query:**  
```sh
GET http://35.200.185.69:8000/v1/autocomplete?query=a
```
✅ The API returned **10 results** in the response.  

#### **Testing Common Pagination Parameters:**  
```sh
GET http://35.200.185.69:8000/v1/autocomplete?query=a&limit=50
```
```sh
GET http://35.200.185.69:8000/v1/autocomplete?query=a&offset=10
```
❌ The response remained **unchanged**, confirming that the API **does not support pagination** (i.e., there are no `next_page`, `offset`, or `limit` parameters).  

#### **Conclusion:** 

- The API **returns a maximum of 10 results per request**.  
- **There is no way to request additional results beyond this limit**.  
- **No pagination indicators exist** (`offset`, `page`, `cursor`, etc.).  

### **3. Consistency of API Responses**  
To check if the API dynamically generates new results over time, we **repeated the same query multiple times**:  

```sh
GET http://35.200.185.69:8000/v1/autocomplete?query=a
```
Each time, we received **the exact same set of results**, confirming that:  
✅ The dataset is **static** (it does not change between requests).  
✅ The API does **not introduce new names dynamically** over time.  

### **4. Depth of Autocomplete Search**  
We tested whether deeper queries (`aa`, `aaa`, etc.) yield more results:  

```sh
GET http://35.200.185.69:8000/v1/autocomplete?query=aa
GET http://35.200.185.69:8000/v1/autocomplete?query=aaa
GET http://35.200.185.69:8000/v1/autocomplete?query=aab
GET http://35.200.185.69:8000/v1/autocomplete?query=aac
```
❌ Each query returned:  
```json
{
    "count": 0,
    "results": []
}
```
This confirms:  
- The API **does not support deeper searches** (i.e., it does not provide further results beyond initial prefixes).  
- The **entire dataset is limited to direct prefixes** (e.g., "a" returns results, but "aa" does not).  
- **Once a query returns `{ count: 0 }`, no further results exist for deeper searches.**  

### **5. Testing with Special Characters and Numbers**  
To further explore dataset constraints, we tested **special characters and numeric inputs**:  
```sh
GET http://35.200.185.69:8000/v1/autocomplete?query=1
GET http://35.200.185.69:8000/v1/autocomplete?query=#
GET http://35.200.185.69:8000/v1/autocomplete?query=@
```
Each returned:  
```json
{
    "count": 0,
    "results": []
}
```
This confirms:  
- The dataset **only contains alphabetic names** (special characters and numbers return no results).  

---

## **Summary of Findings**  
| **Aspect**            | **Observation**                                      |
|----------------------|------------------------------------------------------ |
| **Rate Limit**       | 100 requests per minute                               |
| **Pagination**       | **Not Supported** (no `offset`, `limit`, `page`)      |
| **Response Consistency** | **Static** (same results for identical queries)   |
| **Search Depth**     | Only **single-character prefixes** return results     |
| **Character Support** | **Alphabetic only** (no numbers or special characters)|






2. **Strategy Selection**: 
 

## **1. Introduction**  
Since the goal is to extract **all possible names** from an **autocomplete API**, we need an **efficient search strategy**. This problem is fundamentally a **search problem**, where we explore possible prefixes to retrieve names.  

Given the **API constraints** (rate limiting, lack of pagination, and fixed results per query), we consider **four standard approaches**:  
- **Breadth-First Search (BFS)**  
- **Binary Search**  
- **Trie-based Approach**  
- **Hybrid Strategy (Trie + Parallel API Requests)**  

Each strategy has different trade-offs in **efficiency, memory usage, and complexity**.

---

## **2. Strategy Breakdown**  

### **2.1 Breadth-First Search (BFS)**
#### **Concept:**  
BFS explores the search space **level by level**. It starts with an initial set of queries (e.g., `"a"`, `"b"`, ..., `"z"`) and then **expands the search** by appending additional characters **only if new names are discovered**.  

#### **Implementation Details:**  

1. **Initialize a queue** with the alphabet (`a-z` as starting prefixes).  
2. **Fetch autocomplete results** for each prefix.  
3. **Expand the queue** with the results (only unique names).  
4. Continue until the queue is exhausted.  

#### **Advantages:**  
✅ Ensures **all names are discovered**.  
✅ Avoids unnecessary deeper searches.  

#### **Disadvantages:**  
❌ **Inefficient** for large datasets (explores every possible combination).  
❌ Can take **longer to converge** due to its exhaustive nature.  

#### **Time Complexity:**  
- **Worst Case:** **O(N)**, where **N** is the number of queries required to explore all names.  
- **Best Case:** **O(log N)**, if common prefixes are shared and eliminate redundant queries.  

---

### **2.2 Binary Search Strategy**  
#### **Concept:**  
Binary Search is generally used for **ordered datasets**. Since autocomplete results are **not numerically ordered**, we cannot apply a standard binary search. However, we can try a **modified version**:  
1. Perform a **binary-like expansion** by splitting character spaces (e.g., `"m"` to check if names are in the **first or second half** of the alphabet).  
2. Narrow the search space dynamically based on results.  

#### **Why Not Ideal Here?**  
🚫 This approach **requires sorted data**, but the API does not return results in a sorted manner.  
🚫 The API **only returns 10 results per query**, so it doesn't give full information to implement binary narrowing.  

#### **Time Complexity:**  
- **Not applicable**, since the dataset does not support binary search principles.  

✅ **Verdict:** **Not a suitable method** for this problem.  

---

### **2.3 Trie-Based Search Strategy**  
#### **Concept:**  
A **Trie (Prefix Tree)** is an **efficient data structure** for handling prefix-based searching, making it a **natural fit** for an autocomplete system.  

#### **Implementation Steps:**  
1. Start with an **empty Trie**.  
2. Perform queries starting with **`a-z`** and insert results into the Trie.  
3. Continue searching deeper only if new prefixes exist in the Trie.  
4. **Avoid redundant queries** by checking existing nodes before sending API requests.  

#### **Advantages:**  
✅ **Optimized memory usage** (only stores needed prefixes).  
✅ **Avoids redundant queries**, improving efficiency.  

#### **Disadvantages:**  
❌ Slightly higher **implementation complexity**.  
❌ May still require **many API calls** to extract all names.  

#### **Time Complexity:**  
- **Insertion & Search:** **O(N)** (where N is the total number of names).  
- **API Calls:** **Optimized**, since unnecessary prefixes are not queried.  

---

### **2.4 Hybrid Strategy (Trie + Parallel Requests + Rate Limiting)**
 **Most Optimized Approach**  

#### **Concept:**  
This approach **combines Trie-based searching with concurrent API requests** while handling **rate limiting and API exhaustion**.  

#### **Implementation Steps:**  
1. **Use a Trie** to store discovered names and prefixes.  
2. **Perform parallel API requests** (but limit to **100 per minute** to respect rate limits).  
3. **Dynamically adjust search depth** based on API responses.  
4. **Terminate early if no new names are found** (to avoid redundant requests).  

#### **Rate Limit Handling:**  
- Uses a **queue system** to manage requests within **100 per minute**.  
- Implements a **600ms delay per request** (i.e., `60000ms / 100 = 600ms`).  
- Uses **batch processing** (sending multiple requests simultaneously but within limits).  

#### **API Exhaustion Handling:**  
- If the API **stops returning new names** (i.e., `{ count: 0 }` for all queries), the process **terminates early**.  
- Implements **logging** to track progress and avoid unnecessary retries.  

#### **Advantages:**  
✅ **Highly efficient**, reducing redundant API calls.  
✅ **Handles rate limits gracefully** without hitting API restrictions.  
✅ **Scalable**, allowing fast extraction of all available names.  

#### **Disadvantages:**  
❌ Requires careful **synchronization** of API requests.  
❌ Slightly more **complex implementation** compared to BFS or Trie alone.  

#### **Time Complexity:**  
- **Trie Insert/Search:** **O(N)** (N = total names).  
- **API Calls:** **Minimized**, making it more efficient than BFS.  
- **Overall Complexity:** **O(N) but highly optimized in practice**.  

---

## **3. Strategy Selection & Final Verdict**  
| **Strategy**        | **Time Complexity** | **Best Use Case**                        | **Drawbacks**                       |
|---------------------|--------------------|---------------------------------|--------------------------------|
| **BFS Search**      | **O(N)**           | Simple search, small datasets  | Redundant queries, slow.       |
| **Binary Search**   | **Not Applicable** | Ordered data only               | API data is unordered.        |
| **Trie Search**     | **O(N)**           | Prefix-based, optimized lookups | Still sequential API calls.   |
| **Hybrid Strategy** | **O(N), optimized**| Large datasets, efficient API calls | Complex implementation.   |

### **✅ Best Approach: Hybrid Strategy (Trie + Parallel Requests + Rate Limiting)**
- **Handles API rate limits** without exceeding 100 requests/min.  
- **Avoids redundant searches** using a Trie.  
- **Uses parallel requests** to maximize efficiency.  
- **Terminates early** if API exhaustion occurs.  

---

## **4. Conclusion**  
Given the **API constraints**, a **hybrid approach** (Trie + Parallel Requests + Rate Limiting) is the **most efficient way** to extract all possible names.  
This strategy ensures **optimal performance**, **minimal API overhead**, and **fast extraction** while respecting the API's limitations. 

3. **Rate Limiting**: Handled potential rate limiting by implementing delays between requests and retries on failure. 

When working with APIs, especially public or undocumented ones, **rate limiting** and **API exhaustion** are critical challenges that must be addressed to ensure smooth and efficient data extraction.  

### **1. Understanding Rate Limiting**  
Rate limiting is a restriction imposed by an API provider to **control the number of requests a client can make within a given time period**. This helps prevent abuse, ensures fair usage among multiple users, and protects server resources.  

### **2. Rate Limit Discovery**  
In our case, we discovered the rate limit by making multiple requests until we received the following response:  
```json
{
    "detail": "100 per 1 minute"
}
```
This indicates that the API allows a **maximum of 100 requests per minute**. Exceeding this limit results in temporary blocking or delays.  

### **3. Handling Rate Limits Efficiently**  
To ensure our solution operates within the API constraints, we implemented the following strategies:  

#### **a. Request Throttling**  
We use controlled request intervals to avoid exceeding the rate limit:  
- **Batch Requests**: Instead of sending requests in quick succession, we pace them over time.  
- **Delay Mechanism**: Introduce a short delay between requests (e.g., using `setTimeout` in JavaScript).  

#### **b. Exponential Backoff**  
If we hit the rate limit, we implement an **exponential backoff strategy**, which involves:  
- **Waiting progressively longer** (e.g., 1s → 2s → 4s → 8s) before retrying.  
- **Reducing unnecessary retries** to prevent further exhaustion.  

#### **c. Parallel Processing Within Limits**  
To optimize data retrieval, we send **multiple requests in parallel** while ensuring we stay **within the 100 requests per minute limit**.  

---

### **4. API Exhaustion and Its Challenges**  
API exhaustion occurs when:  
- The API **has a fixed dataset** and returns no new results after a certain point.  
- There is **no pagination**, so additional requests **cannot fetch more data** beyond the initial response.  

### **5. Handling API Exhaustion** 

- **Caching Responses**: Storing previous responses locally to avoid redundant API calls.  
- **Prefix Expansion Strategy**: Instead of blindly querying deeper prefixes (which return `{ "count": 0 }`), we dynamically adjust our approach to maximize result discovery.  
- **Monitoring Query Effectiveness**: If a query consistently returns an empty result, we avoid further similar queries to prevent unnecessary API requests.  

---

### **6. Key Takeaways**  
| **Challenge**           | **Solution**                                      |
|------------------------|--------------------------------------------------|
| Rate Limit (100/min)   | **Throttle requests**, use **batching**, implement **exponential backoff** |
| No Pagination          | **Optimize queries**, avoid redundant requests  |
| API Exhaustion         | **Cache results**, **adjust search strategy**, **monitor response trends** |

By carefully managing rate limits and API exhaustion, we ensure efficient data extraction while **minimizing unnecessary requests** and **maximizing the number of names retrieved**. 


5. **Logging**: Used a logging utility to track progress and errors during the extraction process.
## **Logging: Tracking Progress and Errors**  

Logging is an essential part of any automated data extraction process, as it helps **monitor execution, debug issues, and track progress** efficiently. In our implementation, we use a structured logging mechanism to capture key events, errors, and performance metrics.  

### **1. Why Logging is Important?**  
- **Debugging**: Helps identify errors or failures in API requests.  
- **Performance Monitoring**: Tracks execution time and request-response cycles.  
- **Rate Limit Management**: Logs API responses to detect when limits are reached.  
- **Data Validation**: Ensures that the results fetched from the API are accurate.  

---

### **2. Logging Implementation in Our Approach**  
We use a **logger utility** that records information at different levels:  

#### **a. Info Logs** (General Progress Updates)  
These logs help track key milestones and execution flow. Example:  
```plaintext
[INFO] Starting data extraction using hybrid strategy...
[INFO] Fetching results for prefix: "a"
[INFO] Successfully retrieved 10 results for "a"
[INFO] Completed extraction. Total names found: 500
```

#### **b. Error Logs** (Handling Failures)  
Errors and exceptions are logged for troubleshooting. Example:  
```plaintext
[ERROR] API request failed for prefix "ab": 429 Too Many Requests
[ERROR] Network timeout while fetching "ac". Retrying in 5 seconds...
```

#### **c. Debug Logs** (Detailed Technical Insights)  
Useful for tracking execution details and debugging complex issues. Example:  
```plaintext
[DEBUG] API response: {"version":"v1", "count":10, "results":["adam","alice"]}
[DEBUG] Trie updated with new entry: "alex"
[DEBUG] Skipping "aa" as it's already in the dataset
```

---

### **3. Key Logging Features in Our Solution**  
| **Feature**        | **Purpose**                                      |
|--------------------|--------------------------------------------------|
| **Structured Logging** | Ensures consistency and readability. |
| **Log Levels (INFO, ERROR, DEBUG)** | Allows filtering relevant details. |
| **Log File Storage** | Saves logs for later analysis and debugging. |
| **Time-Stamped Entries** | Tracks when events occurred. |
| **Error Handling & Retries** | Captures failures and implements retry logic. |

---

### **4. Benefits of Logging in API Extraction**  
✅ **Real-time Monitoring**: Helps track API request flow.  
✅ **Automatic Error Detection**: Identifies API failures and rate limits.  
✅ **Efficient Debugging**: Provides a trail of executed operations.  
✅ **Optimized Performance**: Identifies bottlenecks and redundant queries.  

By implementing a **robust logging system**, we ensure that the extraction process is **transparent, fault-tolerant, and easy to maintain**. 
